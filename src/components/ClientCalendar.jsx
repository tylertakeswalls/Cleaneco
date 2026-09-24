// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features are needed later.

import { useState, useEffect } from "react";
import api from "../api/api";

export default function ClientCalendar({ selectedDate, selectedTimeSlot, onSelectDateTime }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [availability, setAvailability] = useState([]);
    const [unavailableDates, setUnavailableDates] = useState([]);
    const [loading, setLoading] = useState(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3); // 3 days in advance

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30); // 30 days rolling limit

    useEffect(() => {
        const fetchAvailability = async () => {
            try {
                const [availabilityRes, unavailableRes] = await Promise.all([
                    api.get("/orders/availability"),
                    api.get("/unavailable-dates")
                ]);
                setAvailability(availabilityRes.data || []);
                setUnavailableDates(unavailableRes.data || []);
            } catch (error) {
                console.error("Error fetching availability:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAvailability();
    }, []);

    // Get days in month & starting day
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

    // Padding for empty start days of the week
    for (let i = 0; i < startDay; i++) datesArray.push(null);
    for (let d = 1; d <= daysInMonth; d++) datesArray.push(d);

    const goToPrevMonth = () => {
        const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        // Only allow going back if it is the current month
        if (prevMonthDate.getMonth() >= minDate.getMonth() || prevMonthDate.getFullYear() > minDate.getFullYear()) {
            setCurrentDate(prevMonthDate);
        }
    };

    const goToNextMonth = () => {
        const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        // Only allow going forward to next month if it falls within the 30-day window
        if (nextMonthDate <= maxDate || nextMonthDate.getMonth() === maxDate.getMonth()) {
            setCurrentDate(nextMonthDate);
        }
    };

    // Group bookings by date and slot
    const bookingsByDate = (Array.isArray(availability) ? availability : []).reduce((acc, curr) => {
        const d = curr.date;
        if (!acc[d]) acc[d] = { total: 0, slots: {} };
        acc[d].slots[curr.time_slot] = (acc[d].slots[curr.time_slot] || 0) + curr.booking_count;
        acc[d].total += curr.booking_count;
        return acc;
    }, {});

    const handleDateClick = (dateString, isOutOfRange, isFullyBooked, isBlockedAdmin) => {
        if (isOutOfRange || isFullyBooked || isBlockedAdmin) return;
        onSelectDateTime(dateString, ""); // Clear slot when date changes
    };

    const handleSlotClick = (slot) => {
        if (!selectedDate) return;
        onSelectDateTime(selectedDate, slot);
    };

    if (loading) {
        return <div className="text-center p-3 text-muted"><i className="fas fa-spinner fa-spin me-2"></i>Loading calendar availability...</div>;
    }

    // Get time slots status for selected date
    const selectedDateBookings = selectedDate ? bookingsByDate[selectedDate] : null;
    const slots = [
        { key: "Morning", label: "Morning (8AM - 12PM)" },
        { key: "Afternoon", label: "Afternoon (12PM - 5PM)" },
        { key: "Evening", label: "Evening (5PM - 9PM)" }
    ];

    return (
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "1rem", overflow: "hidden" }}>
            <div className="card-header border-0 d-flex align-items-center justify-content-between p-3" style={{ background: "#ebf3ee" }}>
                <button
                    type="button"
                    className="btn btn-sm btn-success border-0 px-3 fw-bold"
                    onClick={goToPrevMonth}
                    style={{ background: "#0D8D1E" }}
                    disabled={currentDate.getMonth() === minDate.getMonth() && currentDate.getFullYear() === minDate.getFullYear()}
                >
                    ‹
                </button>
                <h5 className="mb-0 fw-bold text-dark">
                    {currentDate.toLocaleString("default", { month: "long" })} {currentDate.getFullYear()}
                </h5>
                <button
                    type="button"
                    className="btn btn-sm btn-success border-0 px-3 fw-bold"
                    onClick={goToNextMonth}
                    style={{ background: "#0D8D1E" }}
                    disabled={currentDate.getMonth() === maxDate.getMonth() && currentDate.getFullYear() === maxDate.getFullYear()}
                >
                    ›
                </button>
            </div>

            <div className="card-body p-3">
                {/* Calendar Grid */}
                <div className="text-center fw-bold mb-2 text-muted" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', fontSize: '0.85rem' }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d}>{d}</div>
                    ))}
                </div>

                <div className="text-center" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {datesArray.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} style={{ visibility: "hidden" }}></div>;

                        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dateString = formatDate(dateObj);

                        const isOutOfRange = dateObj < minDate || dateObj > maxDate;

                        const dayData = bookingsByDate[dateString];
                        const totalBookings = dayData ? dayData.total : 0;
                        const isFullyBooked = totalBookings >= 3;
                        const isSelected = dateString === selectedDate;
                        const unavailableInfo = unavailableDates.find(u => u.date === dateString);
                        const isBlockedAdmin = !!unavailableInfo;

                        let bgStyle = "#f8fafc";
                        let textColor = "#1e293b";
                        let borderStyle = "1px solid #e2e8f0";
                        let cursorStyle = "pointer";
                        let statusText = "Available";

                        if (isOutOfRange) {
                            bgStyle = "#f1f5f9";
                            textColor = "#cbd5e1";
                            borderStyle = "1px solid #f1f5f9";
                            cursorStyle = "not-allowed";
                            statusText = "";
                        } else if (isBlockedAdmin) {
                            bgStyle = "#e2e8f0";
                            textColor = "#64748b";
                            borderStyle = "1px solid #cbd5e1";
                            cursorStyle = "not-allowed";
                            statusText = unavailableInfo.reason || "Unavailable";
                        } else if (isFullyBooked) {
                            bgStyle = "#fee2e2";
                            textColor = "#ef4444";
                            borderStyle = "1px solid #fca5a5";
                            cursorStyle = "not-allowed";
                            statusText = "Fully Booked";
                        } else if (totalBookings > 0) {
                            bgStyle = "#f0fdf4";
                            textColor = "#15803d";
                            borderStyle = "1px solid #bbf7d0";
                            statusText = `${3 - totalBookings} Left`;
                        }

                        if (isSelected) {
                            borderStyle = "2px solid #0D8D1E";
                            bgStyle = "#dcfce7";
                        }

                        return (
                            <div key={`day-${day}`}>
                                <div
                                    onClick={() => handleDateClick(dateString, isOutOfRange, isFullyBooked, isBlockedAdmin)}
                                    className="d-flex flex-column align-items-center justify-content-center p-1 rounded w-100"
                                    style={{
                                        background: bgStyle,
                                        color: textColor,
                                        border: borderStyle,
                                        cursor: cursorStyle,
                                        height: "65px",
                                        transition: "all 0.2s ease-in-out",
                                        opacity: isOutOfRange ? 0.5 : 1
                                    }}
                                >
                                    <div className="fw-bold fs-6">{day}</div>
                                    {statusText && (
                                        <div style={{ fontSize: "0.65rem", fontWeight: "700" }}>
                                            {statusText}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Time slot picker */}
                {selectedDate && (
                    <div className="mt-4 p-3 rounded" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <h6 className="fw-bold mb-3 text-dark text-center">
                            <i className="far fa-clock me-2 text-success"></i>
                            Select Time Slot for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h6>
                        <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                            {slots.map((slot) => {
                                const isBooked = selectedDateBookings && selectedDateBookings.slots[slot.key] >= 1;
                                const isSlotSelected = selectedTimeSlot === slot.key;

                                let btnClass = "btn btn-outline-success flex-grow-1 fw-bold py-2";
                                if (isBooked) {
                                    btnClass = "btn btn-light text-muted border-0 flex-grow-1 py-2";
                                } else if (isSlotSelected) {
                                    btnClass = "btn btn-success flex-grow-1 fw-bold py-2";
                                }

                                return (
                                    <button
                                        key={slot.key}
                                        type="button"
                                        className={btnClass}
                                        onClick={() => !isBooked && handleSlotClick(slot.key)}
                                        style={{
                                            borderRadius: "0.5rem",
                                            borderColor: (!isBooked && !isSlotSelected) ? "#0D8D1E" : undefined,
                                            color: (!isBooked && !isSlotSelected) ? "#0D8D1E" : undefined,
                                            background: isSlotSelected ? "#0D8D1E" : undefined,
                                            cursor: isBooked ? "not-allowed" : "pointer",
                                            opacity: isBooked ? 0.6 : 1
                                        }}
                                        disabled={isBooked}
                                    >
                                        {slot.label} {isBooked ? " (Booked)" : " (Available)"}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="card-footer bg-white border-0 d-flex flex-wrap justify-content-center gap-3 py-2 small text-muted">
                <span className="d-flex align-items-center"><span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}></span> Available</span>
                <span className="d-flex align-items-center"><span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}></span> Booked Partially</span>
                <span className="d-flex align-items-center"><span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#fee2e2", border: "1px solid #fca5a5" }}></span> Fully Booked</span>
                <span className="d-flex align-items-center"><span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#e2e8f0", border: "1px solid #cbd5e1" }}></span> Unavailable</span>
            </div>
        </div>
    );
}
