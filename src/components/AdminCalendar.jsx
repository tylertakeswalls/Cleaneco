import { useState } from "react";
import "../assets/styles/adminCalendar.css";

// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features (like week view or drag-drop) are needed later.

export default function AdminCalendar({ orders = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

    // Convert orders into date map
    const ordersByDate = orders.reduce((acc, order) => {
        if (!order.date) return acc;
        
        let d = String(order.date);
        // Clean up time if it's an ISO string
        if (d.includes("T")) {
            d = d.split("T")[0];
        } else if (d.includes("/")) {
            // Convert MM/DD/YYYY or M/D/YYYY to YYYY-MM-DD
            const parts = d.split("/");
            if (parts.length === 3) {
                const mm = parts[0].padStart(2, "0");
                const dd = parts[1].padStart(2, "0");
                const yyyy = parts[2];
                d = `${yyyy}-${mm}-${dd}`;
            }
        }
        
        if (!acc[d]) acc[d] = [];
        acc[d].push(order);
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
                                        <span key={i} className={`status-badge status-${o.status.replace(" ", "").toLowerCase()}`}>
                                            {o.status}
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
                <div className="calendar-popup" style={{ top: popupPosition.top, left: popupPosition.left }}>
                    <div className="popup-title">{selectedDate}</div>
                    <button className="calendar-close-btn" onClick={handleClosePopup}>Close</button>
                </div>
            )}
        </div>
    );
}
