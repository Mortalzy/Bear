import { useEffect, useRef, useState } from 'react';
import { RequestForm } from './features/request/RequestForm.jsx';
import { Icon } from './components/Icon.jsx';
import { company, services, steps } from './data/site.js';
import styles from './App.module.css';

const navigation = [['#services', 'Услуги'], ['#production', 'Производство'], ['#process', 'Этапы работы'], ['#contacts', 'Контакты']];
function readTheme() {
  try { const saved = localStorage.getItem('bear-theme'); if (saved === 'light' || saved === 'dark') return saved; } catch { /* Storage can be disabled. */ }
  return 'light';
}
function Action({ children, href = '#request', dark = false, className = '' }) {
  return <a className={`${styles.action} ${dark ? styles.actionDark : ''} ${className}`} href={href}>{children}<Icon size={20} /></a>;
}
function Photo({ name, alt, className = '', eager = false }) {
  return <img className={className} src={`/images/${name}.webp`} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}
export function App() {
  const [theme, setTheme] = useState(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const privacy = useRef(null);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('bear-theme', theme); } catch { /* Theme still works without persistence. */ }
  }, [theme]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <div className={styles.page} id="top">
      <a className={styles.skip} href="#main">Перейти к содержимому</a>
      <header className={styles.header}>
        <a href="#top" className={styles.brand} aria-label="BEAR — главная">BEAR<span>PRODUCTION</span></a>
        <nav aria-label="Главная навигация" className={styles.desktopNav}>{navigation.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
        <div className={styles.headerActions}>
          <button className={styles.themeToggle} type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'} aria-pressed={theme === 'dark'}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={19} /><span>{theme === 'light' ? 'Тёмная' : 'Светлая'}</span></button>
          <Action className={styles.headerCta}>Обсудить проект</Action>
          <button className={styles.menuToggle} type="button" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} aria-controls="mobile-nav" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        </div>
      </header>
      <nav id="mobile-nav" hidden={!menuOpen} className={styles.mobileNav} aria-label="Мобильная навигация">{navigation.map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<Icon size={18} /></a>)}<a href="#request" onClick={() => setMenuOpen(false)}>Обсудить проект<Icon size={18} /></a></nav>
      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.statusDot} />BEAR / ПРОИЗВОДСТВО ИЗ СТЕКЛОПЛАСТИКА</p>
            <h1 id="hero-title">От идеи<br />до серийного<br />производства<span className={styles.heroPeriod}>.</span></h1>
            <p className={styles.heroDescription}>Проектируем. Создаём прототипы.<br />Воплощаем ваши идеи в готовые изделия.</p>
            <Action dark>Рассчитать проект</Action>
            <div className={styles.heroBottom}><span>МОДЕЛИ / МАТРИЦЫ / ГОТОВЫЕ ИЗДЕЛИЯ</span><span>01 — 05</span></div>
          </div>
          <div className={styles.heroVisual}>
            <Photo name="hero" alt="Корпус катера из стеклопластика в производственном цехе Bear" eager />
            <div className={styles.heroImageLabel}>РЕАЛЬНЫЕ ЗАДАЧИ.<br />РЕАЛЬНОЕ ПРОИЗВОДСТВО.</div>
            <a href="#production" className={styles.heroBadge}><span>Форма.<br />Материал.<br />Результат.</span><Icon size={32} /></a>
          </div>
        </section>
        <div className={styles.ticker} aria-hidden="true"><span>ОТ ЭСКИЗА ДО ИЗДЕЛИЯ</span><b>✳</b><span>ПОЛНЫЙ ЦИКЛ</span><b>✳</b><span>СТЕКЛОПЛАСТИК</span><b>✳</b><span>BEAR</span><b>✳</b><span>ОТ ЭСКИЗА ДО ИЗДЕЛИЯ</span></div>
        <section id="services" className={styles.section} aria-labelledby="services-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / ЧТО МЫ ДЕЛАЕМ</p><h2 id="services-title">Наши услуги</h2></div><p>Подключаемся на любом этапе.<br />Берём на себя весь путь — от первой модели<br className={styles.desktopBreak} /> до серийного выпуска.</p></div>
          <div className={styles.serviceGrid}>{services.map((service) => <article className={styles.serviceCard} key={service.id}>
            <div className={styles.serviceCopy}><span className={styles.serviceNumber}>{service.id}</span><h3>{service.title}</h3><p>{service.description}</p></div>
            <Photo name={service.image} alt={`${service.title.replace('\n', ' ')} — пример работы Bear`} />
            <details className={styles.serviceDetails}><summary><span>Подробнее об услуге</span><Icon name="plus" size={19} /></summary><p>{service.detail}</p><a href="#request">Обсудить задачу <Icon size={16} /></a></details>
          </article>)}<a className={styles.customCard} href="#request"><span className={styles.eyebrow}>НЕСТАНДАРТНАЯ ЗАДАЧА?</span><h3>Начнём<br />с вашей<br />идеи.</h3><div><span>Расскажите нам о проекте</span><Icon size={38} /></div></a></div>
        </section>
        <section id="process" className={`${styles.section} ${styles.process}`} aria-labelledby="process-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / ОТ ЗАДАЧИ К РЕЗУЛЬТАТУ</p><h2 id="process-title">Как мы работаем</h2></div><p>Понятная последовательность.<br />Одна команда на всех этапах.</p></div>
          <ol className={styles.steps}>{steps.map(([title, description], index) => <li key={title}><div className={styles.stepNumber}><span>0{index + 1}</span><Icon size={25} /></div><h3>{title}</h3><p>{description}</p></li>)}</ol>
        </section>
        <section id="production" className={styles.section} aria-labelledby="production-title">
          <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / МЕСТО, ГДЕ ИДЕИ ОБРЕТАЮТ ФОРМУ</p><h2 id="production-title">Наше производство</h2></div><p>Модели, оснастка и готовые изделия.<br />Фотографии наших работ и цеха.</p></div>
          <div className={styles.productionGrid}><figure className={styles.workshop}><Photo name="workshop" alt="Общий вид производственного цеха Bear" /><figcaption><span>ПРОИЗВОДСТВЕННЫЙ ЦЕХ / САМАРА</span><Icon size={23} /></figcaption></figure><figure><Photo name="boat" alt="Готовый корпус изделия из стеклопластика" /><figcaption>ОТ МОДЕЛИ — К ГОТОВОЙ ФОРМЕ</figcaption></figure><figure><Photo name="tooling" alt="Матрицы и производственная оснастка в цехе" /><figcaption>МАТРИЦЫ И ОСНАСТКА</figcaption></figure></div>
        </section>
        <section className={`${styles.section} ${styles.partners}`} aria-labelledby="partners-title"><div><p className={styles.eyebrow}>04 / СОТРУДНИЧЕСТВО</p><h2 id="partners-title">С нами<br />работают</h2></div><div className={styles.partner}><span className={styles.partnerSymbol}>РП</span><div><small>ООО</small><strong>Регионпласт</strong></div></div><div className={styles.partner}><span className={styles.boatSymbol}>≋</span><div><small>ООО</small><strong>К-БОАТС</strong></div></div><a className={styles.partnerCta} href="#request">Стать<br />партнёром<Icon size={30} /></a></section>
        <section id="request" className={`${styles.section} ${styles.request}`} aria-labelledby="request-title"><div className={styles.requestCopy}><p className={styles.eyebrow}>05 / ВАШ СЛЕДУЮЩИЙ ПРОЕКТ</p><h2 id="request-title">Обсудим<br />ваш проект?</h2><p>Расскажите, что вы хотите создать.<br />Приложите чертёж, эскиз или фотографию —<br className={styles.desktopBreak} /> начнём с вашей задачи.</p>{company.email ? <a href={`mailto:${company.email}`} className={styles.contactEmail}>{company.email}<Icon size={22} /></a> : <span className={styles.contactEmail}>Email компании</span>}{company.phone ? <a href={company.phoneHref} className={styles.contactPhone}>{company.phone}</a> : <span className={styles.contactPhone}>Телефон компании</span>}<span className={styles.requestFootnote}>ОТ ИДЕИ ДО ГОТОВОГО ИЗДЕЛИЯ <Icon size={17} /></span></div><RequestForm onOpenPrivacy={() => privacy.current?.showModal()} /></section>
      </main>
      <footer id="contacts" className={styles.footer}><div className={styles.footerTop}><div><a className={styles.brand} href="#top">BEAR<span>PRODUCTION</span></a><p>Производство из стеклопластика.<br />От идеи до результата.</p></div><nav aria-label="Навигация в подвале">{navigation.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav><div className={styles.footerContacts}>{company.phone && <a href={company.phoneHref}>{company.phone}</a>}{company.email && <a href={`mailto:${company.email}`}>{company.email}</a>}{company.mapUrl ? <a href={company.mapUrl} target="_blank" rel="noreferrer"><Icon name="pin" size={18} />Самара · Открыть на карте<Icon size={16} /></a> : <span>Контакты и карта будут добавлены</span>}{company.coordinates && <small>{company.coordinates}</small>}</div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} BEAR</span>{company.legalName && <span>{company.legalName}{company.inn && ` · ИНН ${company.inn}`}</span>}<button type="button" onClick={() => privacy.current?.showModal()}>Персональные данные</button><a href="#top" aria-label="Наверх"><Icon size={19} /></a></div></footer>
      <dialog ref={privacy} className={styles.dialog} onClick={(event) => { if (event.target === event.currentTarget) privacy.current.close(); }}><div><button className={styles.dialogClose} type="button" aria-label="Закрыть" onClick={() => privacy.current.close()}><Icon name="close" /></button><p className={styles.eyebrow}>ДЕМОНСТРАЦИОННАЯ ВЕРСИЯ</p><h2>Персональные данные</h2><p>Форма сейчас работает локально: имя, телефон, email, описание и выбранные файлы не отправляются на сервер и не сохраняются после перезагрузки страницы.</p><p>В браузере сохраняется только выбранная тема оформления. Контактные данные компании будут добавлены перед публикацией сайта.</p><p>Перед запуском онлайн-заявок здесь будет размещена согласованная политика обработки персональных данных.</p><button className={styles.action} type="button" onClick={() => privacy.current.close()}>Понятно<Icon name="check" size={18} /></button></div></dialog>
    </div>
  );
}
