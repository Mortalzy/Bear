import { useRef, useState } from 'react';
import styles from './ServiceCarousel.module.css';

export function ServiceCarousel({ title, images }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef(null);
  const label = title.replace(/\s+/g, ' ');

  function move(direction) {
    setActiveIndex((index) => (index + direction + images.length) % images.length);
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
      aria-label={`Фотографии: ${label}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <img
        className={styles.image}
        src={`/images/${images[activeIndex].image}.png`}
        alt={images[activeIndex].alt}
        loading="lazy"
        decoding="async"
      />

      {images.length > 1 && (
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
            {activeIndex + 1} / {images.length}
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
