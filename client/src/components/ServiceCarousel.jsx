import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../utils/mediaUrl.js';
import styles from './ServiceCarousel.module.css';

function SlideMedia({ slide, onReady }) {
  if (slide.video) {
    return (
      <video
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
        onCanPlay={onReady}
        onError={onReady}
        onContextMenu={(event) => event.preventDefault()}
      />
    );
  }

  return (
    <img
      className={styles.media}
      src={mediaUrl(slide.image)}
      alt={slide.alt}
      loading={onReady ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={onReady}
      onError={onReady}
    />
  );
}

export function ServiceCarousel({ title, slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState(null);
  const [incomingReady, setIncomingReady] = useState(false);
  const touchStart = useRef(null);
  const label = title.replace(/\s+/g, ' ');
  const visibleIndex = incomingIndex ?? activeIndex;

  useEffect(() => {
    if (incomingIndex === null || !incomingReady) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      finishTransition(incomingIndex);
      return;
    }

    const timeout = window.setTimeout(() => finishTransition(incomingIndex), 450);
    return () => window.clearTimeout(timeout);
  }, [incomingIndex, incomingReady]);

  function finishTransition(index) {
    if (index !== incomingIndex) return;
    setActiveIndex(index);
    setIncomingIndex(null);
    setIncomingReady(false);
  }

  function move(direction) {
    const index = (visibleIndex + direction + slides.length) % slides.length;

    if (index === activeIndex) {
      setIncomingIndex(null);
    } else {
      setIncomingIndex(index);
    }
    setIncomingReady(false);
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
      <div className={styles.viewport}>
        {[activeIndex, incomingIndex]
          .filter((index, position) => index !== null && (position === 0 || index !== activeIndex))
          .map((index) => (
            <div
              key={index}
              className={`${styles.layer} ${index === incomingIndex ? styles.incoming : ''} ${index === incomingIndex && incomingReady ? styles.ready : ''}`}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && event.propertyName === 'opacity') {
                  finishTransition(index);
                }
              }}
            >
              <SlideMedia
                slide={slides[index]}
                onReady={index === incomingIndex ? () => setIncomingReady(true) : undefined}
              />
            </div>
          ))}
      </div>

      {slides.length > 1 && (
        <div className={styles.controls}>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => move(-1)}
            aria-label={`Предыдущий слайд: ${label}`}
          >
            <span aria-hidden="true">←</span>
          </button>
          <span className={styles.counter} aria-live="polite" aria-atomic="true">
            {visibleIndex + 1} / {slides.length}
          </span>
          <button
            className={styles.arrow}
            type="button"
            onClick={() => move(1)}
            aria-label={`Следующий слайд: ${label}`}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
