import { useState } from 'react';
import { UPLOAD_POLICY, validateFileSelection } from '@bear/shared';
import styles from './RequestForm.module.css';

export function RequestForm() {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  function selectFiles(event) {
    const selected = Array.from(event.target.files ?? []);
    const problems = validateFileSelection(selected);
    setErrors(problems);
    setFiles(problems.length ? [] : selected);
    if (problems.length) event.target.value = '';
  }

  return (
    <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
      <p id="request-status" role="status">
        Онлайн-заявки пока не принимаются. Отправка будет доступна после запуска сайта.
      </p>
      <label>Имя<input name="name" autoComplete="name" maxLength={100} required /></label>
      <label>Телефон<input name="phone" type="tel" autoComplete="tel" placeholder="+7" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Описание задачи<textarea name="description" rows={5} maxLength={5000} required /></label>
      <label>Прикрепить файлы
        <input name="files" type="file" multiple accept={UPLOAD_POLICY.extensions.join(',')}
          onChange={selectFiles} aria-describedby="file-help file-errors" />
      </label>
      <p id="file-help" className={styles.hint}>
        До {UPLOAD_POLICY.maxFiles} файлов, до 50 МБ каждый. DWG, DXF, STEP, PDF, JPG.
        Выбранные файлы остаются в браузере и пока не загружаются.
      </p>
      <div id="file-errors" role="alert">
        {errors.map((error) => <p key={error} className={styles.error}>{error}</p>)}
      </div>
      {files.length > 0 && <ul>{files.map((file, index) => (
        <li key={index}>{file.name} — {(file.size / 1000000).toFixed(2)} МБ</li>
      ))}</ul>}
      <button type="submit" disabled aria-describedby="request-status">Отправка пока недоступна</button>
    </form>
  );
}
