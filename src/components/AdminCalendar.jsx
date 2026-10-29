import { useState } from "react";
import "../assets/styles/adminCalendar.css";
import { resolveOrderSchedule } from "../utils/helpers";
import { formatName } from "../utils/formatName";

// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features (like week view or drag-drop) are needed later.

export default function AdminCalendar({ orders = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

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

    const handleDateClick = (day, e) => {
        if (!day) return;
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const formattedDate = formatDate(clickedDate);
        setSelectedDate(formattedDate);

        const rect = e.currentTarget.getBoundingClientRect();
        setPopupPosition({
            top: rect.bottom + window.scrollY + 8,
            left: rect.left + window.scrollX + 8,
        });
        setPopupVisible(true);
    };

    const handleClosePopup = () => setPopupVisible(false);
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
                            onClick={(e) => handleDateClick(day, e)}
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

            {/* Date popup */}
            {popupVisible && (
                <div className="calendar-popup" style={{ top: popupPosition.top, left: popupPosition.left, minWidth: "260px", maxWidth: "340px" }}>
                    <div className="popup-title fw-bold mb-2 pb-1 border-bottom d-flex justify-content-between align-items-center">
                        <span>{selectedDate}</span>
                        <span className="badge bg-secondary" style={{ fontSize: "0.7rem" }}>
                            {selectedDayOrders.length} {selectedDayOrders.length === 1 ? "Order" : "Orders"}
                        </span>
                    </div>
                    {selectedDayOrders.length === 0 ? (
                        <div className="text-muted small mb-2">No scheduled orders on this date.</div>
                    ) : (
                        <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: "220px", overflowY: "auto" }}>
                            {selectedDayOrders.map((o, idx) => (
                                <div key={o.order_id || o.id || idx} className="p-2 rounded border bg-light" style={{ fontSize: "0.78rem" }}>
                                    <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                                        <span className="fw-bold text-dark text-truncate">{o.service_name || o.service_type || "Service"}</span>
                                        <span
                                            style={{
                                                backgroundColor: o._schedule.badgeBg,
                                                color: o._schedule.badgeColor,
                                                border: `1px solid ${o._schedule.badgeBorder}`,
                                                borderRadius: "999px",
                                                padding: "1px 7px",
                                                fontSize: "0.68rem",
                                                fontWeight: 600,
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            {o._schedule.label}
                                        </span>
                                    </div>
                                    <div className="text-muted text-truncate">
                                        {formatName(o)}{o.order_id ? ` • ${o.order_id}` : ""}
                                    </div>
                                    {(o._schedule.activeSlot || o.truck_team) && (
                                        <div className="text-secondary mt-1">
                                            {o._schedule.activeSlot && <>Slot: <strong>{o._schedule.activeSlot}</strong></>}
                                            {o._schedule.activeSlot && o.truck_team ? " • " : ""}
                                            {o.truck_team && <span>{o.truck_team}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="calendar-close-btn w-100" onClick={handleClosePopup}>Close</button>
                </div>
            )}
        </div>
    );
}
