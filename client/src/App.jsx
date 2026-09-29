import { RequestForm } from './features/request/RequestForm.jsx';
import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="#" className={styles.brand} aria-label="Bear — главная">BEAR</a>
        <a href="#request">Обсудить задачу</a>
      </header>
      <main>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Проект сайта</p>
          <h1>Bear</h1>
          <p>Разделы услуг и примеры работ появятся после подготовки материалов.</p>
        </section>
        <section id="request" aria-labelledby="request-title">
          <h2 id="request-title">Обсудить задачу</h2>
          <RequestForm />
        </section>
      </main>
      <footer className={styles.footer}>Bear</footer>
    </div>
  );
}
