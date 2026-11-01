import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "../assets/styles/adminCalendar.css";
import { resolveOrderSchedule } from "../utils/helpers";
import { formatName } from "../utils/formatName";

// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features (like week view or drag-drop) are needed later.

export default function AdminCalendar({ orders = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDrawerClosing, setIsDrawerClosing] = useState(false);
    const drawerOpenedAt = useRef(0);

    const navigate = useNavigate();

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

    return (
        <div className="admin-calendar-container">
            <div className="calendar-header">
                <button onClick={goToPrevMonth}>‹</button>
                <h2>
                    {currentDate.toLocaleString("default", { month: "long" })}{" "}
                    {currentDate.getFullYear()}
                </h2>
                <button onClick={goToNextMonth} disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.5, cursor: canGoNext ? 'pointer' : 'not-allowed' }}>›</button>
            </div>

            <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="calendar-day-header">{day}</div>
                ))}

                {datesArray.map((day, index) => {
                    const dateString =
                        day != null ? formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) : null;
                    const dayOrders = dateString ? ordersByDate[dateString] : [];

                    return (
                        <div
                            key={index}
                            className={`calendar-cell ${day ? "clickable" : ""} ${dateString === selectedDate ? "selected" : ""}`}
                            onClick={() => handleDateClick(day)}
                            onDoubleClick={() => handleDateDoubleClick(day)}
                            title={day ? (dateString === selectedDate && isDrawerOpen ? "Double-click to close details" : "Click to view details") : ""}
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
                                            {formatName(o)}{o.order_id ? ` • ${o.order_id}` : ""}
                                        </div>
                                        {(o._schedule.activeSlot || o.truck_team) && (
                                            <div className="text-secondary small mt-1">
                                                {o._schedule.activeSlot && <>Slot: <strong>{o._schedule.activeSlot}</strong></>}
                                                {o._schedule.activeSlot && o.truck_team ? " • " : ""}
                                                {o.truck_team && <span>{o.truck_team}</span>}
                                            </div>
                                        )}
                                        {o.order_id && (
                                            <div className="text-success small mt-2 text-end fw-semibold">
                                                Manage Order <i className="fas fa-chevron-right ms-1" style={{ fontSize: "0.65rem" }}></i>
                                            </div>
                                        )}
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
