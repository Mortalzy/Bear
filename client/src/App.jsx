import { useEffect, useRef, useState } from 'react';
import { RequestForm } from './features/request/RequestForm.jsx';
import { Icon } from './components/Icon.jsx';
import { ServiceCarousel } from './components/ServiceCarousel.jsx';
import { company, productionGalleries, services, steps } from './data/site.js';
import { mediaUrl } from './utils/mediaUrl.js';
import styles from './App.module.css';

const navigation = [
  ['#services', 'Услуги'],
  ['#production', 'Производство'],
  ['#process', 'Этапы работы'],
  ['#contacts', 'Контакты'],
];

function readTheme() {
  try {
    const saved = localStorage.getItem('bear-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* Storage can be disabled. */
  }
  return 'light';
}

function Action({ children, href = '#request', dark = false, className = '' }) {
  return (
    <a className={`${styles.action} ${dark ? styles.actionDark : ''} ${className}`} href={href}>
      {children}
      <Icon size={20} />
    </a>
  );
}

function Photo({ path, alt, className = '', eager = false }) {
  return (
    <img
      className={className}
      src={mediaUrl(path)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export function App() {
  const [theme, setTheme] = useState(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const privacy = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('bear-theme', theme);
    } catch {
      /* Theme still works without persistence. */
    }
  }, [theme]);

  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  return (
    <div className={styles.page} id="top">
      <a className={styles.skip} href="#main">
        Перейти к содержимому
      </a>

      <header className={styles.header}>
        <a href="#top" className={styles.brand} aria-label="BEAR — главная">
          <img className={styles.brandLogo} src="/images/black-logo__transparent.png" alt="" />
          МЕДВЕДЬ
        </a>

        <nav aria-label="Главная навигация" className={styles.desktopNav}>
          {navigation.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <button
            className={styles.themeToggle}
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}
            aria-pressed={theme === 'dark'}
          >
            <Icon
              key={theme}
              className={styles.themeIcon}
              name={theme === 'light' ? 'moon' : 'sun'}
              size={19}
            />
            <span>{theme === 'light' ? 'Тёмная' : 'Светлая'}</span>
          </button>

          <Action className={styles.headerCta}>Обсудить проект</Action>

          <button
            className={styles.menuToggle}
            type="button"
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </header>

      <nav
        id="mobile-nav"
        hidden={!menuOpen}
        className={styles.mobileNav}
        aria-label="Мобильная навигация"
      >
        {navigation.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setMenuOpen(false)}>
            {label}
            <Icon size={18} />
          </a>
        ))}
        <a href="#request" onClick={() => setMenuOpen(false)}>
          Обсудить проект
          <Icon size={18} />
        </a>
      </nav>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.statusDot} />
              МЕДВЕДЬ / ПРОИЗВОДСТВО ИЗ СТЕКЛОПЛАСТИКА
            </p>

            <h1 id="hero-title">
              От идеи
              <br />
              до серийного
              <br />
              производства
              <span className={styles.heroPeriod}>.</span>
            </h1>

            <p className={styles.heroDescription}>
              Проектируем. Создаём прототипы.
              <br />
              Воплощаем ваши идеи в готовые изделия.
            </p>

            <Action dark>Рассчитать проект</Action>

            <div className={styles.heroBottom}>
              <span>МОДЕЛИ / МАТРИЦЫ / ГОТОВЫЕ ИЗДЕЛИЯ</span>
              <span>01 — 05</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <Photo
              path="Фото производства/9.png"
              alt="Производственная мастерская с лодкой и материалами"
              eager
            />
            <div className={styles.heroImageLabel}>
              РЕАЛЬНЫЕ ЗАДАЧИ.
              <br />
              РЕАЛЬНОЕ ПРОИЗВОДСТВО.
            </div>

            <a href="#production" className={styles.heroBadge} aria-label="О нашем производстве">
              <img className={styles.heroLogo} src="/images/orange-logo__black-phone.png" alt="" />
            </a>
          </div>
        </section>

        <div className={styles.ticker} aria-hidden="true">
          <span>ИДЕЯ</span>
          <b>✳</b>
          <span>ПРОЕКТ</span>
          <b>✳</b>
          <span>ПРОТОТИП</span>
          <b>✳</b>
          <span>МАТРИЦА</span>
          <b>✳</b>
          <span>ИЗДЕЛИЕ</span>
        </div>

        <section
          id="services"
          className={`${styles.section} ${styles.forestBackground}`}
          aria-labelledby="services-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>01 / ЧТО МЫ ДЕЛАЕМ</p>
              <h2 id="services-title">Наши услуги</h2>
            </div>
            <p>
              Подключаемся на любом этапе.
              <br />
              Берём на себя весь путь — от первой модели
              <br className={styles.desktopBreak} /> до серийного выпуска.
            </p>
          </div>

          <div className={styles.serviceGrid}>
            {services.map((service) => (
              <article className={styles.serviceCard} key={service.id}>
                <div className={styles.serviceCopy}>
                  <span className={styles.serviceNumber}>{service.id}</span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </div>

                <ServiceCarousel title={service.title} slides={service.gallery} />

                <details className={styles.serviceDetails}>
                  <summary>
                    <span>Подробнее об услуге</span>
                    <Icon name="plus" size={19} />
                  </summary>
                  <p>{service.detail}</p>
                  <a href="#request">
                    Обсудить задачу <Icon size={16} />
                  </a>
                </details>
              </article>
            ))}

            <a className={styles.customCard} href="#request">
              <span className={styles.eyebrow}>НЕСТАНДАРТНАЯ ЗАДАЧА?</span>
              <h3>
                Начнём
                <br />
                с вашей
                <br />
                идеи.
              </h3>
              <div>
                <span>Расскажите нам о проекте</span>
                <Icon size={38} />
              </div>
            </a>
          </div>
        </section>

        <section
          id="process"
          className={`${styles.section} ${styles.process}`}
          aria-labelledby="process-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>02 / ОТ ЗАДАЧИ К РЕЗУЛЬТАТУ</p>
              <h2 id="process-title">Как мы работаем</h2>
            </div>
            <p>
              Понятная последовательность.
              <br />
              Одна команда на всех этапах.
            </p>
          </div>

          <ol className={styles.steps}>
            {steps.map(([title, description], index) => (
              <li key={title}>
                <div className={styles.stepNumber}>
                  <span>0{index + 1}</span>
                  <Icon size={25} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className={styles.forestBackground}>
          <section id="production" className={styles.section} aria-labelledby="production-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>03 / МЕСТО, ГДЕ ИДЕИ ОБРЕТАЮТ ФОРМУ</p>
                <h2 id="production-title">Наше производство</h2>
              </div>
              <p>
                Модели, оснастка и готовые изделия.
                <br />
                Фотографии наших работ и цеха.
              </p>
            </div>

            <div className={styles.productionGrid}>
              {productionGalleries.map(({ id, title, caption, slides }) => (
                <figure key={id}>
                  <ServiceCarousel title={title} slides={slides} />
                  <figcaption>{caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section
            className={`${styles.section} ${styles.partners}`}
            aria-labelledby="partners-title"
          >
            <div>
              <p className={styles.eyebrow}>04 / СОТРУДНИЧЕСТВО</p>
              <h2 id="partners-title">
                С нами
                <br />
                работают
              </h2>
            </div>

            <div className={styles.partner}>
              <span className={styles.partnerSymbol}>РП</span>
              <div>
                <small>ООО</small>
                <strong>Регионпласт</strong>
              </div>
            </div>

            <div className={styles.partner}>
              <span className={styles.boatSymbol}>≋</span>
              <div>
                <small>ООО</small>
                <strong>SUNCRAFT</strong>
              </div>
            </div>

            <a className={styles.partnerCta} href="#request">
              Стать
              <br />
              партнёром
              <Icon size={30} />
            </a>
          </section>
        </div>

        <section
          id="request"
          className={`${styles.section} ${styles.request}`}
          aria-labelledby="request-title"
        >
          <div className={styles.requestCopy}>
            <p className={styles.eyebrow}>05 / ВАШ СЛЕДУЮЩИЙ ПРОЕКТ</p>
            <h2 id="request-title">
              Обсудим
              <br />
              ваш проект?
            </h2>
            <p>
              Расскажите, что вы хотите создать.
              <br />
              Приложите чертёж, эскиз или фотографию —
              <br className={styles.desktopBreak} /> начнём с вашей задачи.
            </p>

            <div className={styles.requestContacts}>
              <div className={styles.contactRow}>
                <span>ИП</span>
                <strong>{company.legalName.replace(/^ИП\s*/, '')}</strong>
              </div>
              <div className={styles.contactRow}>
                <span>ИНН</span>
                <strong>{company.inn}</strong>
              </div>
              <div className={styles.contactRow}>
                <span>Телефоны</span>
                <div className={styles.contactPhones}>
                  {company.phones.map((phone) => (
                    <a key={phone.href} href={phone.href} className={styles.contactPhone}>
                      {phone.label}
                    </a>
                  ))}
                </div>
              </div>
              <div className={styles.contactRow}>
                <span>Электронный адрес</span>
                <a href={`mailto:${company.email}`} className={styles.contactEmail}>
                  {company.email}
                  <Icon size={20} />
                </a>
              </div>
            </div>

            <span className={styles.requestFootnote}>
              ОТ ИДЕИ ДО ГОТОВОГО ИЗДЕЛИЯ <Icon size={17} />
            </span>
          </div>

          <RequestForm onOpenPrivacy={() => privacy.current?.showModal()} />
        </section>
      </main>

      <footer id="contacts" className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <a className={styles.brand} href="#top" aria-label="BEAR — главная">
              <img className={styles.brandLogo} src="/images/black-logo__transparent.png" alt="" />
              МЕДВЕДЬ
            </a>
            <p>
              Производство из стеклопластика.
              <br />
              От идеи до результата.
            </p>
          </div>

          <nav aria-label="Навигация в подвале">
            {navigation.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>

          <div className={styles.footerContacts}>
            <span className={styles.footerLabel}>КОНТАКТЫ</span>
            {company.phones.map((phone) => (
              <a key={phone.href} href={phone.href}>
                {phone.label}
              </a>
            ))}
            {company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}
            {company.mapUrl && (
              <a className={styles.mapLink} href={company.mapUrl} target="_blank" rel="noreferrer">
                <Icon name="pin" size={18} />
                Производство · точка на карте
                <Icon size={16} />
              </a>
            )}
            {company.coordinates && <small>Координаты: {company.coordinates}</small>}
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} МЕДВЕДЬ</span>
          {company.legalName && (
            <span>
              {company.legalName}
              {company.inn && ` · ИНН ${company.inn}`}
            </span>
          )}
          <button type="button" onClick={() => privacy.current?.showModal()}>
            Обработка данных
          </button>
          <a href="#top" aria-label="Наверх">
            <Icon size={19} />
          </a>
        </div>
      </footer>

      <dialog
        ref={privacy}
        className={styles.dialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) privacy.current.close();
        }}
      >
        <div>
          <button
            className={styles.dialogClose}
            type="button"
            aria-label="Закрыть"
            onClick={() => privacy.current.close()}
          >
            <Icon name="close" />
          </button>

          <p className={styles.eyebrow}>ИНФОРМАЦИЯ ДЛЯ ЗАЯВИТЕЛЕЙ</p>
          <h2>Обработка данных</h2>
          <p>
            При отправке формы имя, телефон, email, описание проекта и прикреплённые файлы
            передаются на сервер сайта и направляются на почту компании для рассмотрения заявки
            и связи с вами.
          </p>
          <p>
            По вопросам обработки данных можно написать на{' '}
            <a href={`mailto:${company.email}`}>{company.email}</a> или позвонить по телефонам
            из раздела контактов. Данные компании: {company.legalName}, ИНН {company.inn}.
          </p>
          <p>
            В браузере сохраняется только выбранная тема оформления. Если заявку не удалось
            отправить, форма покажет ошибку.
          </p>

          <button className={styles.action} type="button" onClick={() => privacy.current.close()}>
            Понятно
            <Icon name="check" size={18} />
          </button>
        </div>
      </dialog>
    </div>
  );
}
