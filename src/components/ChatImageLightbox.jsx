import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export const CHAT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export const MAX_CHAT_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export const resolveChatImageUrl = (url) => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const validateChatImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No image selected.' };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only JPG, PNG, WEBP, or GIF images are supported.' };
  }
  if (file.size > MAX_CHAT_IMAGE_SIZE) {
    return { valid: false, error: 'Image size must be 5 MB or smaller.' };
  }
  return { valid: true };
};

export const formatImageFileSize = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const extractPastedImageFile = (clipboardEvent) => {
  const items = clipboardEvent?.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  return null;
};

export const mergePolledMessages = (prevMessages, fetchedMessages) => {
  const incoming = Array.isArray(fetchedMessages) ? fetchedMessages : [];
  const pendingOptimistic = (prevMessages || []).filter((m) => String(m?._id || '').startsWith('temp-'));
  const combined = pendingOptimistic.length > 0 ? [...incoming, ...pendingOptimistic] : incoming;

  if (
    combined.length !== prevMessages.length ||
    (combined.length > 0 &&
      prevMessages.length > 0 &&
      combined[combined.length - 1]._id !== prevMessages[prevMessages.length - 1]._id)
  ) {
    return combined;
  }
  return prevMessages;
};

export default function ChatImageLightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  const fullUrl = resolveChatImageUrl(typeof image === 'string' ? image : image.url);
  const label = (typeof image === 'object' && image.name) || 'Chat Image Attachment';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2050,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="d-flex align-items-center justify-content-between w-100 mb-3 px-2"
        style={{ maxWidth: '1000px', color: '#ffffff' }}
      >
        <div className="d-flex align-items-center gap-2 text-truncate me-3">
          <i className="fas fa-image text-success"></i>
          <span className="fw-semibold small text-truncate">{label}</span>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {!fullUrl.startsWith('blob:') && (
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-light rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1"
            >
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.75rem' }}></i>
              <span>Open Original</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-dark rounded-circle d-inline-flex align-items-center justify-content-center border border-secondary"
            style={{ width: '34px', height: '34px' }}
            title="Close Preview (Esc)"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* Image Stage */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="d-flex align-items-center justify-content-center"
        style={{ maxWidth: '92vw', maxHeight: '82vh' }}
      >
        <img
          src={fullUrl}
          alt={label}
          style={{
            maxWidth: '92vw',
            maxHeight: '82vh',
            objectFit: 'contain',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            backgroundColor: '#0f172a'
          }}
        />
      </div>
    </div>,
    document.body
  );
}

