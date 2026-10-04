import { useRef, useState } from 'react';
import { mediaUrl } from '../utils/mediaUrl.js';
import styles from './ServiceCarousel.module.css';

export function ServiceCarousel({ title, slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef(null);
  const label = title.replace(/\s+/g, ' ');
  const slide = slides[activeIndex];

  function move(direction) {
    setActiveIndex((index) => (index + direction + slides.length) % slides.length);
  }

  function handleTouchStart(event) {
    touchStart.current = {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY,
    };
  }

  function handleTouchEnd(event) {
    if (!touchStart.current) return;

    const dx = event.changedTouches[0].clientX - touchStart.current.x;
    const dy = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      move(dx < 0 ? 1 : -1);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  }

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription="карусель"
      aria-label={`Фото и видео: ${label}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slide.video ? (
        <video
          key={activeIndex}
          className={`${styles.media} ${styles.video}`}
          src={mediaUrl(slide.video)}
          poster={slide.poster ? mediaUrl(slide.poster) : undefined}
          aria-label={slide.alt}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen"
          tabIndex={-1}
          onContextMenu={(event) => event.preventDefault()}
        />
      ) : (
        <img
          className={styles.media}
          src={mediaUrl(slide.image)}
          alt={slide.alt}
          loading="lazy"
          decoding="async"
        />
      )}

      {slides.length > 1 && (
        <div className={styles.controls}>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => move(-1)}
            aria-label={`Предыдущее фото: ${label}`}
          >
            <span aria-hidden="true">←</span>
          </button>
          <span className={styles.counter} aria-live="polite" aria-atomic="true">
            {activeIndex + 1} / {slides.length}
          </span>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => move(1)}
            aria-label={`Следующее фото: ${label}`}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
