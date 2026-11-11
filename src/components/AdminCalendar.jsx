import { formatOrderReference, previewPdfBlob, resolveOrderSchedule, formatPhoneNumber } from '../utils/helpers';
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
    const [dispatchFilter, setDispatchFilter] = useState('all'); // 'all' | 'truck' | 'inspection'
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

    // Reset filter to 'all' whenever a new date is selected
    useEffect(() => {
        setDispatchFilter('all');
    }, [selectedDate]);

    const isInspectionJob = (o) => {
        const phase = o._schedule?.phase;
        if (phase === 'inspection' || phase === 'pref_inspection') return true;
        if (phase === 'execution' || phase === 'completed') return false;
        return !o.service_execution_date && !o.has_final_price && o.status !== 'Completed';
    };

    const isExecutionJob = (o) => {
        const phase = o._schedule?.phase;
        if (phase === 'execution' || phase === 'completed') return true;
        if (phase === 'inspection' || phase === 'pref_inspection') return false;
        return Boolean(o.service_execution_date) || o.status === 'Completed';
    };

    const truckOrders = selectedDayOrders.filter(isExecutionJob);
    const inspectionOrders = selectedDayOrders.filter(isInspectionJob);

    const activeOrders = dispatchFilter === 'truck'
        ? truckOrders
        : dispatchFilter === 'inspection'
            ? inspectionOrders
            : selectedDayOrders;

    const handlePrintDispatchSheet = async (targetMode = dispatchFilter) => {
        const targetList = targetMode === 'truck'
            ? truckOrders
            : targetMode === 'inspection'
                ? inspectionOrders
                : selectedDayOrders;

        if (!selectedDate || targetList.length === 0) return;
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

            const isInspectionMode = targetMode === 'inspection';
            const isTruckMode = targetMode === 'truck';

            let docTitle = "DAILY DISPATCH RUN SHEET (ALL JOBS)";
            let dateSubtitle = `Service Execution & Inspection Date: ${formattedDateStr}`;
            let jobsSubtitle = `Total Assigned Jobs: ${targetList.length} Stop${targetList.length === 1 ? '' : 's'}`;
            let filename = `Cleaneco_Dispatch_Sheet_${selectedDate}.pdf`;

            if (isInspectionMode) {
                docTitle = "DAILY INSPECTION DISPATCH RUN SHEET";
                dateSubtitle = `Site Inspection Date: ${formattedDateStr}`;
                jobsSubtitle = `Total Assigned Inspections: ${targetList.length} Site Visit${targetList.length === 1 ? '' : 's'}`;
                filename = `Cleaneco_Inspection_Dispatch_${selectedDate}.pdf`;
            } else if (isTruckMode) {
                docTitle = "DAILY TRUCK DISPATCH RUN SHEET";
                dateSubtitle = `Service Execution Date: ${formattedDateStr}`;
                jobsSubtitle = `Total Assigned Jobs: ${targetList.length} Truck Stop${targetList.length === 1 ? '' : 's'}`;
                filename = `Cleaneco_Truck_Dispatch_${selectedDate}.pdf`;
            }

            // Centered Document Header matching Cleaneco Monthly/Quarterly Reports, Final Billing & Receipts
            doc.setFont("times", "bold");
            doc.setFontSize(12.5);
            doc.setTextColor(0, 0, 0);
            doc.text(docTitle, 105, 75, { align: "center" });

            doc.setFont("times", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(40, 40, 40);
            doc.text(dateSubtitle, 105, 81, { align: "center" });

            doc.setFontSize(8.5);
            doc.setTextColor(80, 80, 80);
            doc.text(`${jobsSubtitle}   |   Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 105, 86, { align: "center" });

            // Group and sort orders by assigned truck team / inspector, then time slot
            const slotOrder = { 'Morning': 1, 'Afternoon': 2, 'Evening': 3 };
            const sortedOrders = [...targetList].sort((a, b) => {
                const teamA = (a.truck_team || '').trim() || (isInspectionMode ? 'Inspection Team' : 'Unassigned Fleet');
                const teamB = (b.truck_team || '').trim() || (isInspectionMode ? 'Inspection Team' : 'Unassigned Fleet');
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
                "#",
                isInspectionMode ? "Assigned Inspector" : "Team / Crew",
                "Time Slot",
                "Order & Client",
                isInspectionMode ? "Target Services" : "Service & Scope",
                isInspectionMode ? "Inspection Address & Landmark" : "Destination Address & Landmark",
                isInspectionMode ? "Inspection Notes" : "Field Notes & Remarks"
            ];

            const tableRows = sortedOrders.map((o, idx) => {
                const stopNumber = String(idx + 1);
                const defaultTeamLabel = isInspectionMode ? 'Inspection Team' : 'Unassigned';
                const teamText = (o.truck_team || '').trim() || defaultTeamLabel;
                const rawSlot = o._schedule?.activeSlot || o.time_slot || 'Standard';
                const rawLabel = o._schedule?.shortPhaseTag || o._schedule?.label || 'Scheduled';
                const phaseLabel = rawLabel
                    .replace('Pref. Inspection', 'Pref. Insp')
                    .replace('Service Execution', 'Execution')
                    .replace('Site Inspection', 'Inspection');
                const slotText = `${rawSlot}\n(${phaseLabel})`;
                
                const clientName = formatName(o);
                const formattedPhone = o.phone ? formatPhoneNumber(o.phone) : '';
                const phoneText = formattedPhone ? `\nMobile: ${formattedPhone}` : '';
                const orderRef = o.order_id ? `#${formatOrderReference(o.order_id)}` : 'N/A';
                const orderClientText = `${orderRef}\n${clientName}${phoneText}`;

                // Parse multi-service bookings cleanly so each service gets its own distinct bullet
                let rawServices = [];
                if (Array.isArray(o.service_names) && o.service_names.length > 0) {
                    rawServices = o.service_names;
                } else if (Array.isArray(o.services) && o.services.length > 0) {
                    rawServices = o.services.map(s => s.service_name || s.service_type).filter(Boolean);
                } else if (o.service_name || o.service_type) {
                    rawServices = (o.service_name || o.service_type).split(/,\s*/);
                }

                const uniqueServices = [...new Set(rawServices.map(s => (s || '').trim()).filter(Boolean))];
                let serviceScopeText = '';
                if (uniqueServices.length > 1) {
                    serviceScopeText = uniqueServices.map(s => `• ${s}`).join('\n');
                } else if (uniqueServices.length === 1) {
                    serviceScopeText = uniqueServices[0];
                } else {
                    serviceScopeText = 'Sanitation Service';
                }

                if (!isInspectionMode && o.total_trips && o.total_trips > 1) {
                    serviceScopeText += `\n(${o.total_trips} trips required)`;
                }

                const addressText = (o.address || 'Address on record').replace(/\s+,/g, ',');
                const landmarkText = o.landmark ? `\nLandmark: ${o.landmark.trim()}` : '';
                const addressLandmarkText = `${addressText}${landmarkText}`;

                const notesList = [];
                if (o.site_photo_url) {
                    notesList.push("• Difficult Site Access");
                }
                if (o.notes && o.notes.trim()) {
                    notesList.push(`• Client: ${o.notes.trim().slice(0, 80)}`);
                }
                if (o.internal_notes && o.internal_notes.trim()) {
                    notesList.push(`• Dispatch: ${o.internal_notes.trim().slice(0, 80)}`);
                }

                const signAction = isInspectionMode ? "[ ] Inspected" : "[ ] Completed";
                const signBlock = `${signAction}\nSign: ________`;
                const crewNotesText = notesList.length > 0
                    ? `${notesList.join('\n')}\n\n${signBlock}`
                    : signBlock;

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

            // Table with #F0F0F0 gray header and crisp black borders matching Cleaneco Reports, Billing & Receipts
            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 92,
                margin: { left: 10, right: 10 },
                theme: 'grid',
                styles: { 
                    font: 'times', 
                    fontSize: 8, 
                    textColor: [0, 0, 0],
                    cellPadding: 2, 
                    overflow: 'linebreak',
                    valign: 'top',
                    lineWidth: 0.2,
                    lineColor: [0, 0, 0]
                },
                headStyles: { 
                    fillColor: [240, 240, 240], // Official Cleaneco #F0F0F0 header fill
                    textColor: [0, 0, 0],       // Black text
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    lineWidth: 0.2,
                    lineColor: [0, 0, 0]
                },
                bodyStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    lineWidth: 0.2,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { cellWidth: 7, halign: 'center' },
                    1: { cellWidth: 21, fontStyle: 'bold' },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 38 },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 40 },
                    6: { cellWidth: 29 }
                }
            });

            // Sign-off / Verification section matching Cleaneco operational manifest standards
            let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 220;
            if (finalY > 255) {
                doc.addPage();
                finalY = 25;
            }

            doc.setFont("times", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(0, 0, 0);

            const ackHeader = isInspectionMode
                ? "Inspection Manifest Acknowledged by:"
                : "Acknowledged by:";
            doc.text(ackHeader, 125, finalY);
            doc.text("Name & Signature: ____________________________", 125, finalY + 7);

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
                        <div className="calendar-drawer-toolbar">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <span className="small text-muted fw-semibold">
                                    Dispatch Schedule:
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-solid-primary d-inline-flex align-items-center gap-2 fw-bold"
                                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                                    onClick={() => handlePrintDispatchSheet(dispatchFilter)}
                                    disabled={isGeneratingPdf || activeOrders.length === 0}
                                    title={
                                        dispatchFilter === 'inspection'
                                            ? "Generate printable Dedicated Inspection Dispatch Sheet"
                                            : dispatchFilter === 'truck'
                                                ? "Generate printable Dedicated Truck Fleet Dispatch Sheet"
                                                : "Generate printable Master Dispatch Run Sheet"
                                    }
                                >
                                    {isGeneratingPdf ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-file-pdf"></i>
                                            <span>
                                                {dispatchFilter === 'inspection'
                                                    ? 'Print Inspection Sheet'
                                                    : dispatchFilter === 'truck'
                                                        ? 'Print Truck Dispatch'
                                                        : 'Print Dispatch Sheet'}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Filter Segmented Control */}
                            <div className="d-flex gap-1 p-1 bg-white border rounded-2">
                                <button
                                    type="button"
                                    className="btn btn-sm flex-fill py-1 px-2 fw-semibold border-0"
                                    style={{
                                        fontSize: '0.74rem',
                                        borderRadius: '4px',
                                        backgroundColor: dispatchFilter === 'all' ? '#0D8D1E' : 'transparent',
                                        color: dispatchFilter === 'all' ? '#ffffff' : '#64748b',
                                        boxShadow: dispatchFilter === 'all' ? '0 1px 3px rgba(13, 141, 30, 0.3)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => setDispatchFilter('all')}
                                >
                                    All ({selectedDayOrders.length})
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm flex-fill py-1 px-2 fw-semibold border-0"
                                    style={{
                                        fontSize: '0.74rem',
                                        borderRadius: '4px',
                                        backgroundColor: dispatchFilter === 'truck' ? '#0D8D1E' : 'transparent',
                                        color: dispatchFilter === 'truck' ? '#ffffff' : '#64748b',
                                        boxShadow: dispatchFilter === 'truck' ? '0 1px 3px rgba(13, 141, 30, 0.3)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => setDispatchFilter('truck')}
                                    title="Show only Service Execution orders assigned to truck teams"
                                >
                                    <i className="fas fa-truck me-1"></i>Trucks ({truckOrders.length})
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm flex-fill py-1 px-2 fw-semibold border-0"
                                    style={{
                                        fontSize: '0.74rem',
                                        borderRadius: '4px',
                                        backgroundColor: dispatchFilter === 'inspection' ? '#0D8D1E' : 'transparent',
                                        color: dispatchFilter === 'inspection' ? '#ffffff' : '#64748b',
                                        boxShadow: dispatchFilter === 'inspection' ? '0 1px 3px rgba(13, 141, 30, 0.3)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => setDispatchFilter('inspection')}
                                    title="Show only Site Inspection visits for field inspectors"
                                >
                                    <i className="fas fa-clipboard-check me-1"></i>Inspections ({inspectionOrders.length})
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="calendar-drawer-body">
                        {activeOrders.length === 0 ? (
                            <div className="text-center text-muted py-5">
                                <i className={`fas ${dispatchFilter === 'inspection' ? 'fa-clipboard-check' : dispatchFilter === 'truck' ? 'fa-truck' : 'fa-calendar-check'} fs-2 text-secondary mb-2 opacity-50 d-block`}></i>
                                <p className="mb-0 fw-semibold">
                                    {dispatchFilter === 'inspection'
                                        ? 'No site inspections scheduled on this date.'
                                        : dispatchFilter === 'truck'
                                            ? 'No truck service executions scheduled on this date.'
                                            : 'No orders scheduled on this date.'}
                                </p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {activeOrders.map((o, idx) => (
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
