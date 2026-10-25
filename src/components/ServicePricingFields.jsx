import React from 'react';

/**
 * Reusable component to render pricing fields for a service.
 * Supports both Client Order Form and Admin Quotation / Inspection Editor.
 */
function ServicePricingFields({
  service,
  values = {},
  onChange,
  justifications = {},
  onJustificationChange,
  showJustifications = false,
  showPhotoUpload = false,
  onPhotoChange,
  photoError
}) {
  if (!service) return null;

  if (service.pricing_mode === 'inspection_only') {
    return (
      <div className="alert alert-info py-2 px-3 small mb-0" style={{ borderRadius: '0.5rem' }}>
        <i className="fas fa-info-circle me-1"></i> Price will be determined after on-site inspection.
      </div>
    );
  }

  const fields = service.fields || [];
  if (fields.length === 0) {
    return (
      <div className="text-muted small">
        Standard service rate {service.rate ? `(₱${parseFloat(service.rate).toLocaleString()})` : ''}
      </div>
    );
  }

  return (
    <div className="service-pricing-fields">
      {fields.map((field, idx) => {
        const isLast = idx === fields.length - 1;
        const fieldValue = values[field.key] !== undefined && values[field.key] !== '' 
          ? values[field.key] 
          : (field.default !== undefined ? String(field.default) : (field.type === 'number' ? '1' : field.options?.[0]?.value || ''));

        const selectedOption = field.options?.find(o => String(o.value) === String(fieldValue)) || field.options?.[0];
        const showPhoto = showPhotoUpload && selectedOption?.requires_photo;

        return (
          <div key={field.key || idx} className={`form-group ${isLast && !showPhoto ? 'mb-0' : 'mb-3'}`}>
            <label className="form-label small mb-1 fw-bold text-dark">
              {field.label}
              {field.counts_toward_trips && (
                <span className="badge bg-light text-muted ms-1 border" style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>
                  Affects trips
                </span>
              )}
            </label>

            {field.type === 'number' ? (
              <div className={showJustifications ? 'd-flex gap-2' : ''}>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={showJustifications ? { flex: 1 } : {}}
                  min={field.min !== undefined ? field.min : 1}
                  value={fieldValue}
                  onChange={(e) => onChange && onChange(field.key, e.target.value)}
                />
                {showJustifications && (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ flex: 2 }}
                    placeholder="Reason / Finding note"
                    value={justifications[field.key] || ''}
                    onChange={(e) => onJustificationChange && onJustificationChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ) : (
              <div className={showJustifications ? 'd-flex gap-2' : ''}>
                <select
                  className="form-select form-select-sm"
                  style={showJustifications ? { flex: 1.5 } : {}}
                  value={fieldValue}
                  onChange={(e) => onChange && onChange(field.key, e.target.value)}
                >
                  {(field.options || []).map((opt, oIdx) => (
                    <option key={opt.value ?? oIdx} value={opt.value}>
                      {opt.label}
                      {field.type === 'multiplier' && opt.factor !== undefined && opt.factor !== 1 ? ` (×${opt.factor})` : ''}
                      {field.type === 'surcharge' && opt.amount ? ` (+₱${parseFloat(opt.amount).toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
                {showJustifications && (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ flex: 1.5 }}
                    placeholder="Reason / Finding note"
                    value={justifications[field.key] || ''}
                    onChange={(e) => onJustificationChange && onJustificationChange(field.key, e.target.value)}
                  />
                )}
              </div>
            )}

            {showPhoto && (
              <div className="mt-2 p-2 rounded bg-light border">
                <label className="form-label small mb-1 fw-bold text-danger">
                  <i className="fas fa-camera me-1"></i>
                  Upload Photo for {selectedOption.label} (Optional)
                </label>
                <input
                  type="file"
                  className="form-control form-control-sm"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    if (onPhotoChange) onPhotoChange(file);
                  }}
                />
                <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                  Max size 5MB. Helps our team prepare necessary equipment.
                </small>
                {photoError && <div className="text-danger small mt-1">{photoError}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ServicePricingFields;
