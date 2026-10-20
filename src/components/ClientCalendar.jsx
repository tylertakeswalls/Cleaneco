// ponytail: Custom calendar grid is a known ceiling. Avoid adding complex date-math or timezone logic here.
// Upgrade path: Swap with 'react-big-calendar' or 'react-calendar' if complex features are needed later.

import { useState, useEffect } from "react";
import api from "../api/api";

export default function ClientCalendar({
    selectedDate,
    selectedTimeSlot,
    onSelectDateTime,
    mode = "inspection",
    totalTrips = 1
}) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [availability, setAvailability] = useState([]);
    const [unavailableDates, setUnavailableDates] = useState([]);
    const [availableTrucks, setAvailableTrucks] = useState(2);
    const [loading, setLoading] = useState(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(today);
    minDate.setDate(today.getDate() + 3); // 3 days in advance

    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30); // 30 days rolling limit

    useEffect(() => {
        const fetchCalendarData = async () => {
            try {
                const [availabilityRes, unavailableRes, trucksRes] = await Promise.all([
                    api.get("/orders/availability"),
                    api.get("/unavailable-dates"),
                    api.get("/settings/truck-teams").catch(() => null)
                ]);
                const availData = availabilityRes.data || [];
                setAvailability(availData);
                setUnavailableDates(unavailableRes.data || []);

                if (trucksRes?.data?.available_count !== undefined) {
                    setAvailableTrucks(trucksRes.data.available_count);
                } else if (Array.isArray(availData) && availData.length > 0 && availData[0].available_trucks !== undefined) {
                    setAvailableTrucks(availData[0].available_trucks);
                }
            } catch (error) {
                console.error("Error fetching calendar data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCalendarData();
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

    const currentMonthIdx = currentDate.getFullYear() * 12 + currentDate.getMonth();
    const minMonthIdx = minDate.getFullYear() * 12 + minDate.getMonth();
    const maxMonthIdx = maxDate.getFullYear() * 12 + maxDate.getMonth();

    const canGoPrev = currentMonthIdx > minMonthIdx;
    const canGoNext = currentMonthIdx < maxMonthIdx;

    const goToPrevMonth = () => {
        if (canGoPrev) {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
        }
    };

    const goToNextMonth = () => {
        if (canGoNext) {
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
        }
    };

    // Group bookings by date and slot
    const bookingsByDate = (Array.isArray(availability) ? availability : []).reduce((acc, curr) => {
        const d = curr.date;
        if (!acc[d]) {
            acc[d] = {
                slots: {
                    Morning: { executions: 0, inspections: 0, trucks_left: availableTrucks },
                    Afternoon: { executions: 0, inspections: 0, trucks_left: availableTrucks },
                    Evening: { executions: 0, inspections: 0, trucks_left: availableTrucks }
                },
                has_full_day: false,
                total_executions: 0,
                total_inspections: 0
            };
        }
        if (curr.time_slot && acc[d].slots[curr.time_slot]) {
            const execCount = curr.executions_count || 0;
            const inspCount = curr.inspections_count || 0;
            const tLeft = curr.trucks_left !== undefined ? curr.trucks_left : Math.max(0, availableTrucks - execCount);
            acc[d].slots[curr.time_slot] = {
                executions: execCount,
                inspections: inspCount,
                trucks_left: tLeft
            };
        }
        if (curr.is_full_day_execution) {
            acc[d].has_full_day = true;
        }
        acc[d].total_executions += (curr.executions_count || 0);
        acc[d].total_inspections += (curr.inspections_count || 0);
        return acc;
    }, {});

    const getDayCapacity = (dateString) => {
        const dayData = bookingsByDate[dateString] || {
            slots: {
                Morning: { executions: 0, inspections: 0, trucks_left: availableTrucks },
                Afternoon: { executions: 0, inspections: 0, trucks_left: availableTrucks },
                Evening: { executions: 0, inspections: 0, trucks_left: availableTrucks }
            },
            has_full_day: false,
            total_executions: 0,
            total_inspections: 0
        };

        if (mode === 'inspection') {
            if (dayData.has_full_day) {
                return { isFullyBooked: true, statusText: "Day Locked", type: "full" };
            }
            const bookedCount = ['Morning', 'Afternoon', 'Evening'].filter(
                s => dayData.slots[s].inspections >= 1
            ).length;
            if (bookedCount >= 3) {
                return { isFullyBooked: true, statusText: "Fully Booked", type: "full" };
            }
            if (bookedCount > 0) {
                return { isFullyBooked: false, statusText: `${3 - bookedCount} Left`, type: "partial" };
            }
            return { isFullyBooked: false, statusText: "Available", type: "available" };
        } else {
            // Execution mode
            if (totalTrips >= 5) {
                if (availableTrucks < 2) {
                    return { isFullyBooked: true, statusText: "Needs 2 Trucks", type: "full" };
                }
                if (dayData.has_full_day || dayData.total_executions > 0) {
                    return { isFullyBooked: true, statusText: "Occupied", type: "full" };
                }
                return { isFullyBooked: false, statusText: "Open (Whole Day)", type: "available" };
            } else {
                if (availableTrucks < 1) {
                    return { isFullyBooked: true, statusText: "No Trucks", type: "full" };
                }
                if (dayData.has_full_day) {
                    return { isFullyBooked: true, statusText: "Day Locked", type: "full" };
                }
                const openSlots = ['Morning', 'Afternoon', 'Evening'].filter(
                    s => dayData.slots[s].trucks_left > 0
                ).length;
                if (openSlots === 0) {
                    return { isFullyBooked: true, statusText: "Fully Booked", type: "full" };
                }
                if (openSlots < 3) {
                    return { isFullyBooked: false, statusText: `${openSlots} Slot${openSlots === 1 ? '' : 's'} Open`, type: "partial" };
                }
                return { isFullyBooked: false, statusText: "Available", type: "available" };
            }
        }
    };

    const handleDateClick = (dateString, isOutOfRange, isFullyBooked, isBlockedAdmin) => {
        if (isOutOfRange || isFullyBooked || isBlockedAdmin) return;
        if (mode === 'execution' && totalTrips >= 5) {
            onSelectDateTime(dateString, "Whole Day");
        } else {
            onSelectDateTime(dateString, ""); // Clear slot when date changes
        }
    };

    const handleSlotClick = (slot) => {
        if (!selectedDate) return;
        onSelectDateTime(selectedDate, slot);
    };

    if (loading) {
        return (
            <div className="text-center p-3 text-muted">
                <i className="fas fa-spinner fa-spin me-2"></i>Loading calendar availability...
            </div>
        );
    }

    const selectedDateData = selectedDate ? (bookingsByDate[selectedDate] || {
        slots: {
            Morning: { executions: 0, inspections: 0, trucks_left: availableTrucks },
            Afternoon: { executions: 0, inspections: 0, trucks_left: availableTrucks },
            Evening: { executions: 0, inspections: 0, trucks_left: availableTrucks }
        },
        has_full_day: false
    }) : null;

    const standardSlots = [
        { key: "Morning", label: "Morning (8AM - 12PM)" },
        { key: "Afternoon", label: "Afternoon (12PM - 5PM)" },
        { key: "Evening", label: "Evening (5PM - 9PM)" }
    ];

    return (
        <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: "1rem", overflow: "hidden" }}>
            {/* Mode-specific Header Banner */}
            {mode === 'execution' && (
                <div className={`p-3 border-bottom ${totalTrips >= 5 ? 'bg-warning bg-opacity-10 text-dark' : 'bg-success bg-opacity-10 text-success'}`}>
                    {totalTrips >= 5 ? (
                        <div className="d-flex align-items-center gap-2 small">
                            <i className="fas fa-calendar-check text-warning fs-5"></i>
                            <div>
                                <strong>High-Capacity Service Booking ({totalTrips} Trips):</strong> This service volume requires reserving the <strong>entire day</strong>. Please select your preferred execution date.
                            </div>
                        </div>
                    ) : (
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 small">
                            <div className="d-flex align-items-center gap-2">
                                <i className="fas fa-calendar-check text-success"></i>
                                <span><strong>Service Execution:</strong> Select your preferred date and time slot for your scheduled service.</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="card-header border-0 d-flex align-items-center justify-content-between p-3" style={{ background: "#ebf3ee" }}>
                <button
                    type="button"
                    className="btn btn-sm btn-success border-0 px-3 fw-bold"
                    onClick={goToPrevMonth}
                    style={{ background: "#0D8D1E", opacity: canGoPrev ? 1 : 0.4, cursor: canGoPrev ? 'pointer' : 'not-allowed' }}
                    disabled={!canGoPrev}
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
                    style={{ background: "#0D8D1E", opacity: canGoNext ? 1 : 0.4, cursor: canGoNext ? 'pointer' : 'not-allowed' }}
                    disabled={!canGoNext}
                >
                    ›
                </button>
            </div>

            <div className="card-body p-3">
                {/* Calendar Grid Header */}
                <div className="text-center fw-bold mb-2 text-muted" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', fontSize: '0.85rem' }}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                        <div key={d}>{d}</div>
                    ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="text-center" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {datesArray.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} style={{ visibility: "hidden" }}></div>;

                        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const dateString = formatDate(dateObj);
                        const isOutOfRange = dateObj < minDate || dateObj > maxDate;

                        const unavailableInfo = unavailableDates.find(u => u.date === dateString);
                        const isBlockedAdmin = !!unavailableInfo;

                        const capacity = getDayCapacity(dateString);
                        const isFullyBooked = capacity.isFullyBooked;
                        const isSelected = dateString === selectedDate;

                        let bgStyle = "#f8fafc";
                        let textColor = "#1e293b";
                        let borderStyle = "1px solid #e2e8f0";
                        let cursorStyle = "pointer";
                        let statusText = capacity.statusText;

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
                        } else if (capacity.type === "partial") {
                            bgStyle = "#fef9c3";
                            textColor = "#854d0e";
                            borderStyle = "1px solid #fde047";
                        } else {
                            bgStyle = "#f0fdf4";
                            textColor = "#15803d";
                            borderStyle = "1px solid #bbf7d0";
                        }

                        if (isSelected) {
                            borderStyle = "2px solid #0D8D1E";
                            bgStyle = "#dcfce7";
                            textColor = "#166534";
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
                                        <div style={{ fontSize: "0.62rem", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                                            {statusText}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Time Slot Picker */}
                {selectedDate && (
                    <div className="mt-4 p-3 rounded" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <h6 className="fw-bold mb-3 text-dark text-center">
                            <i className="far fa-clock me-2 text-success"></i>
                            Select Schedule for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h6>

                        {mode === 'execution' && totalTrips >= 5 ? (
                            <div className="text-center py-2">
                                <div 
                                    className="alert border-0 shadow-sm py-2 px-4 small d-inline-flex align-items-center mb-0"
                                    style={{ 
                                        backgroundColor: '#f0fdf4', 
                                        color: '#166534', 
                                        border: '1px solid #bbf7d0', 
                                        borderRadius: '2rem' 
                                    }}
                                >
                                    <i className="fas fa-check-circle me-2 text-success fs-6"></i>
                                    <span className="fw-bold">Whole-Day Booking Selected</span>
                                </div>
                            </div>
                        ) : (
                            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
                                {standardSlots.map((slot) => {
                                    let isBooked = false;

                                    if (selectedDateData) {
                                        if (selectedDateData.has_full_day) {
                                            isBooked = true;
                                        } else if (mode === 'inspection') {
                                            const inspCount = selectedDateData.slots[slot.key]?.inspections || 0;
                                            if (inspCount >= 1) {
                                                isBooked = true;
                                            }
                                        } else {
                                            // execution < 5 trips
                                            const tLeft = selectedDateData.slots[slot.key]?.trucks_left ?? availableTrucks;
                                            if (tLeft <= 0) {
                                                isBooked = true;
                                            }
                                        }
                                    }

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
                                            <div>{slot.label}</div>
                                            {isBooked && (
                                                <small className="d-block text-danger fw-normal" style={{ fontSize: '0.75rem' }}>
                                                    (Booked)
                                                </small>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="card-footer bg-white border-0 d-flex flex-wrap justify-content-center gap-3 py-2 small text-muted">
                <span className="d-flex align-items-center">
                    <span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}></span> Available
                </span>
                <span className="d-flex align-items-center">
                    <span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#fef9c3", border: "1px solid #fde047" }}></span> Partially Booked
                </span>
                <span className="d-flex align-items-center">
                    <span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#fee2e2", border: "1px solid #fca5a5" }}></span> Fully Booked / Locked
                </span>
                <span className="d-flex align-items-center">
                    <span className="d-inline-block rounded-circle me-1" style={{ width: "10px", height: "10px", background: "#e2e8f0", border: "1px solid #cbd5e1" }}></span> Unavailable
                </span>
            </div>
        </div>
    );
}
