import { useState } from "react";
import "../assets/styles/adminCalendar.css";

export default function AdminCalendar({ orders = [] }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [popupVisible, setPopupVisible] = useState(false);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

    // Convert orders into date map
    const ordersByDate = orders.reduce((acc, order) => {
        const d = order.date;
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
    const goToPrevMonth = () =>
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const goToNextMonth = () =>
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    return (
        <div className="admin-calendar-container">
            <div className="calendar-header">
                <button onClick={goToPrevMonth}>‹</button>
                <h2>
                    {currentDate.toLocaleString("default", { month: "long" })}{" "}
                    {currentDate.getFullYear()}
                </h2>
                <button onClick={goToNextMonth}>›</button>
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
