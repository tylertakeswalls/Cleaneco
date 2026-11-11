import { formatOrderReference, previewPdfBlob, resolveOrderSchedule } from '../utils/helpers';
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "../assets/styles/adminCalendar.css";
import { formatName } from "../utils/formatName";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import reportHeaderImg from '../assets/styles/images/report_header.png';

// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features (like week view or drag-drop) are needed later.

export default function AdminCalendar({ orders = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDrawerClosing, setIsDrawerClosing] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const drawerOpenedAt = useRef(0);

    const navigate = useNavigate();
    const isSubAdmin = (sessionStorage.getItem("adminScope") || localStorage.getItem("adminScope")) === "sub_admin";

    // Convert orders into phase-aware date map (Execution Date when scheduled, Confirmed/Preferred Inspection Date otherwise)
    const ordersByDate = orders.reduce((acc, order) => {
        const sched = resolveOrderSchedule(order);
        const d = sched.calendarDateKey;
        if (!d) return acc;

        if (!acc[d]) acc[d] = [];
        acc[d].push({ ...order, _schedule: sched });
        return acc;
    }, {});

    // Calendar helpers
    const getDaysInMonth = () =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const getStartDay = () =>
        new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const daysInMonth = getDaysInMonth();
    const startDay = getStartDay();
    const datesArray = [];
    for (let i = 0; i < startDay; i++) datesArray.push(null);
    for (let d = 1; d <= daysInMonth; d++) datesArray.push(d);

    const handleDateClick = (day) => {
        if (!day) return;
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDate(formatDate(clickedDate));
        setIsDrawerClosing(false); // cancels an in-progress slide-out if a date is clicked mid-close
        if (!isDrawerOpen) {
            drawerOpenedAt.current = Date.now();
            setIsDrawerOpen(true);
        }
    };

    // Double-clicking a date cell closes the drawer (allows admin to dismiss without moving to the X button)
    const handleDateDoubleClick = (day) => {
        if (!day) return;
        if (isDrawerOpen && !isDrawerClosing && Date.now() - drawerOpenedAt.current > 250) {
            handleCloseDrawer();
        }
    };

    // Start the slide-out; the drawer is unmounted once the animation finishes (see handleDrawerAnimationEnd)
    const handleCloseDrawer = () => setIsDrawerClosing(true);

    const handleDrawerAnimationEnd = (event) => {
        if (event.target !== event.currentTarget) return; // ignore animations bubbling up from children
        if (isDrawerClosing) {
            setIsDrawerOpen(false);
            setIsDrawerClosing(false);
        }
    };

    // Dismiss on Escape, or on clicks outside both the drawer and the calendar
    // (clicking another date keeps the drawer open and just swaps its contents)
    useEffect(() => {
        if (!isDrawerOpen) return;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsDrawerClosing(true);
        };
        const handlePointerDown = (event) => {
            if (!event.target.closest(".calendar-drawer, .admin-calendar-container")) {
                setIsDrawerClosing(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        document.addEventListener("mousedown", handlePointerDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handlePointerDown);
        };
    }, [isDrawerOpen]);

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    const canGoNext = currentDate.getFullYear() < maxDate.getFullYear() ||
        (currentDate.getFullYear() === maxDate.getFullYear() && currentDate.getMonth() < maxDate.getMonth());

    const goToPrevMonth = () =>
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToNextMonth = () => {
        if (canGoNext) {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        }
    };

    const selectedDayOrders = selectedDate ? (ordersByDate[selectedDate] || []) : [];

    const handlePrintDispatchSheet = async () => {
        if (!selectedDate || selectedDayOrders.length === 0) return;
        setIsGeneratingPdf(true);
        try {
            const doc = new jsPDF('portrait', 'mm', 'a4');

            const img = new Image();
            img.src = reportHeaderImg;
            await new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });

            try {
                doc.addImage(img, 'PNG', 0, 0, 210, 65);
            } catch (imgErr) {
                console.warn('Letterhead image error:', imgErr);
            }

            const dateObj = new Date(`${selectedDate}T00:00:00`);
            const formattedDateStr = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            doc.setFont("times", "bold");
            doc.setFontSize(12);
            doc.text("Daily Dispatch Run Sheet", 14, 75);

            doc.setFont("times", "normal");
            doc.setFontSize(10);
            doc.text(`Service Execution Date: ${formattedDateStr}`, 14, 81);
            doc.text(`Total Assigned Jobs: ${selectedDayOrders.length}  |  Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 14, 87);

            // Group and sort orders by assigned truck team, then time slot
            const slotOrder = { 'Morning': 1, 'Afternoon': 2, 'Evening': 3 };
            const sortedOrders = [...selectedDayOrders].sort((a, b) => {
                const teamA = (a.truck_team || '').trim() || 'Unassigned Fleet';
                const teamB = (b.truck_team || '').trim() || 'Unassigned Fleet';
                const isUnassignedA = teamA.toLowerCase().includes('unassigned');
                const isUnassignedB = teamB.toLowerCase().includes('unassigned');
                if (isUnassignedA && !isUnassignedB) return 1;
                if (!isUnassignedA && isUnassignedB) return -1;
                const teamCompare = teamA.localeCompare(teamB);
                if (teamCompare !== 0) return teamCompare;

                const slotA = slotOrder[a._schedule?.activeSlot || a.time_slot] || 99;
                const slotB = slotOrder[b._schedule?.activeSlot || b.time_slot] || 99;
                return slotA - slotB;
            });

            const tableColumn = [
                "Stop",
                "Team / Crew",
                "Time Slot",
                "Order & Client",
                "Service & Scope",
                "Destination Address & Landmark",
                "Remarks & Sign-off"
            ];

            const tableRows = sortedOrders.map((o, idx) => {
                const stopNumber = String(idx + 1);
                const teamText = (o.truck_team || '').trim() || 'Unassigned';
                const slotText = `${o._schedule?.activeSlot || o.time_slot || 'Standard'}\n(${o._schedule?.label || 'Scheduled'})`;
                
                const clientName = formatName(o);
                const phoneText = o.phone ? `\nTel: ${o.phone}` : '';
                const orderRef = o.order_id ? `#${formatOrderReference(o.order_id)}` : 'N/A';
                const orderClientText = `${orderRef}\n${clientName}${phoneText}`;

                const serviceName = o.service_name || o.service_type || 'Sanitation Service';
                const tripsText = (o.total_trips && o.total_trips > 1) ? `\n(${o.total_trips} trips required)` : '';
                const serviceScopeText = `${serviceName}${tripsText}`;

                const addressText = o.address || 'Address on record';
                const landmarkText = o.landmark ? `\nLandmark: ${o.landmark}` : '';
                const addressLandmarkText = `${addressText}${landmarkText}`;

                const notesList = [];
                if (o.site_photo_url) {
                    notesList.push("• Difficult Site Access");
                }
                if (o.notes) {
                    notesList.push(`• Client: ${o.notes.slice(0, 80)}`);
                }
                if (o.internal_notes) {
                    notesList.push(`• Dispatch: ${o.internal_notes.slice(0, 80)}`);
                }
                notesList.push("[ ] Completed  Sign: ____________");
                const crewNotesText = notesList.join('\n');

                return [
                    stopNumber,
                    teamText,
                    slotText,
                    orderClientText,
                    serviceScopeText,
                    addressLandmarkText,
                    crewNotesText
                ];
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 93,
                styles: { 
                    fontSize: 8, 
                    cellPadding: 2.5, 
                    overflow: 'linebreak',
                    valign: 'top'
                },
                headStyles: { 
                    fillColor: '#0D8D1E', 
                    textColor: [255, 255, 255], 
                    fontStyle: 'bold',
                    fontSize: 8.5
                },
                alternateRowStyles: {
                    fillColor: [248, 249, 250]
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 26, fontStyle: 'bold' },
                    2: { cellWidth: 22 },
                    3: { cellWidth: 32 },
                    4: { cellWidth: 30 },
                    5: { cellWidth: 36 },
                    6: { cellWidth: 24 }
                }
            });

            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFont("times", "normal");
                doc.setFontSize(8);
                doc.setTextColor(130, 130, 130);
                doc.text(
                    `Cleaneco Waste Management Services • Daily Dispatch Run Sheet • Page ${i} of ${totalPages}`,
                    14,
                    290
                );
            }

            const filename = `Cleaneco_Dispatch_Sheet_${selectedDate}.pdf`;
            previewPdfBlob(doc.output('blob'), filename);
        } catch (pdfErr) {
            console.error('Error generating dispatch sheet:', pdfErr);
            alert('Failed to generate dispatch sheet: ' + (pdfErr.message || pdfErr));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    return (
        <div className="admin-calendar-container">
            <div className="calendar-header">
                <button onClick={goToPrevMonth} aria-label="Previous month">‹</button>
                <h2>
                    {currentDate.toLocaleString("default", { month: "long" })}{" "}
                    {currentDate.getFullYear()}
                </h2>
                <button onClick={goToNextMonth} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.5, cursor: canGoNext ? 'pointer' : 'not-allowed' }} aria-label="Next month">›</button>
            </div>

            <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="calendar-day-header">{day}</div>
                ))}

                {datesArray.map((day, index) => {
                    const dateString =
                        day != null ? formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) : null;
                    const dayOrders = dateString ? ordersByDate[dateString] : [];
                    const hasPending = dayOrders && dayOrders.some(o => o.status === 'Pending' || o._schedule?.phase === 'pref_inspection');

                    return (
                        <div
                            key={index}
                            className={`calendar-cell ${day ? "clickable" : ""} ${dateString === selectedDate ? "selected" : ""} ${hasPending ? "has-pending" : ""}`}
                            onClick={() => handleDateClick(day)}
                            onDoubleClick={() => handleDateDoubleClick(day)}
                            title={day ? (dateString === selectedDate && isDrawerOpen ? "Double-click to close details" : (hasPending ? "Pending bookings/inspections • Click to view details" : "Click to view details")) : ""}
                        >
                            <div className="day-number">{day}</div>
                            {dayOrders?.length > 0 && (
                                <div className="order-status-badges">
                                    {dayOrders.map((o, i) => (
                                        <span
                                            key={i}
                                            className={`status-badge status-${(o.status || "Pending").replace(" ", "").toLowerCase()}`}
                                            title={`${o.order_id || ""} • ${o.service_name || o.service_type || "Service"} • ${o._schedule.label}${o._schedule.activeSlot ? ` (${o._schedule.activeSlot})` : ""}`}
                                        >
                                            {o._schedule.shortPhaseTag}: {o.status}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Date Details Side Drawer (portaled to <body> so it isn't trapped inside the animated .card) */}
            {isDrawerOpen && selectedDate && createPortal(
                <aside
                    className={`calendar-drawer ${isDrawerClosing ? "closing" : ""}`}
                    onAnimationEnd={handleDrawerAnimationEnd}
                    role="dialog"
                    aria-modal="false"
                    aria-label="Scheduled orders for selected date"
                >
                    <div className="calendar-drawer-header">
                        <div className="d-flex align-items-center gap-2">
                            <div className="calendar-drawer-icon">
                                <i className="far fa-calendar-alt text-brand"></i>
                            </div>
                            <div>
                                <h6 className="mb-0 fw-bold text-dark">
                                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                    })}
                                </h6>
                                <small className="text-muted">
                                    {selectedDayOrders.length} {selectedDayOrders.length === 1 ? "Scheduled Service" : "Scheduled Services"}
                                </small>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-close"
                            onClick={handleCloseDrawer}
                            aria-label="Close"
                        />
                    </div>

                    {selectedDayOrders.length > 0 && (
                        <div className="calendar-drawer-toolbar d-flex align-items-center justify-content-between">
                            <span className="small text-muted fw-semibold">
                                <i className="fas fa-truck me-1 text-success"></i>Dispatch Schedule
                            </span>
                            <button
                                type="button"
                                className="btn btn-sm btn-solid-primary d-inline-flex align-items-center gap-2 fw-bold"
                                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                                onClick={handlePrintDispatchSheet}
                                disabled={isGeneratingPdf}
                                title="Generate printable Daily Dispatch Run Sheet for truck teams"
                            >
                                {isGeneratingPdf ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-file-pdf"></i>
                                        <span>Print Dispatch Sheet</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    <div className="calendar-drawer-body">
                        {selectedDayOrders.length === 0 ? (
                            <div className="text-center text-muted py-5">
                                <i className="fas fa-calendar-check fs-2 text-secondary mb-2 opacity-50 d-block"></i>
                                <p className="mb-0 fw-semibold">No orders scheduled on this date.</p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {selectedDayOrders.map((o, idx) => (
                                    <div
                                        key={o.order_id || o.id || idx}
                                        className="p-3 rounded border bg-light calendar-order-card"
                                        style={{ cursor: o.order_id ? "pointer" : "default" }}
                                        onClick={() => {
                                            if (o.order_id) {
                                                navigate(`/admin/orders?orderId=${encodeURIComponent(o.order_id)}`);
                                            }
                                        }}
                                        title={o.order_id ? `Click to view ${o.order_id} in Orders Database` : ""}
                                    >
                                        <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                                            <span className="fw-bold text-dark text-truncate">{o.service_name || o.service_type || "Service"}</span>
                                            <span
                                                style={{
                                                    backgroundColor: o._schedule.badgeBg,
                                                    color: o._schedule.badgeColor,
                                                    border: `1px solid ${o._schedule.badgeBorder}`,
                                                    borderRadius: "999px",
                                                    padding: "2px 8px",
                                                    fontSize: "0.72rem",
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap"
                                                }}
                                            >
                                                {o._schedule.label}
                                            </span>
                                        </div>
                                        <div className="text-muted small text-truncate">
                                            {formatName(o)}{o.order_id ? ` • #${formatOrderReference(o.order_id)}` : ""}
                                        </div>
                                        {(o._schedule.activeSlot || o.truck_team) && (
                                            <div className="text-secondary small mt-1">
                                                {o._schedule.activeSlot && <>Slot: <strong>{o._schedule.activeSlot}</strong></>}
                                                {o._schedule.activeSlot && o.truck_team ? " • " : ""}
                                                {o.truck_team && <span>{o.truck_team}</span>}
                                            </div>
                                        )}
                                        {o.address && (
                                            <div className="text-muted small text-truncate mt-1" title={o.address}>
                                                {o.address}
                                            </div>
                                        )}
                                        <div className="d-flex justify-content-between align-items-center mt-2 pt-1">
                                            {o.address ? (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="d-inline-flex align-items-center gap-1 text-decoration-none fw-semibold"
                                                    style={{
                                                        fontSize: "0.72rem",
                                                        color: "#0D8D1E",
                                                        backgroundColor: "rgba(13, 141, 30, 0.08)",
                                                        border: "1px solid rgba(13, 141, 30, 0.22)",
                                                        borderRadius: "999px",
                                                        padding: "2px 8px"
                                                    }}
                                                    title={`Open "${o.address}" in Google Maps`}
                                                >
                                                    <span>Open in Maps</span>
                                                    <i className="fas fa-external-link-alt" style={{ fontSize: "0.58rem", opacity: 0.75 }}></i>
                                                </a>
                                            ) : <span />}
                                            {o.order_id && (
                                                <div className="text-success small fw-semibold">
                                                    {isSubAdmin ? "View Order" : "Manage Order"} <i className="fas fa-chevron-right ms-1" style={{ fontSize: "0.65rem" }}></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>,
                document.body
            )}
        </div>
    );
}
