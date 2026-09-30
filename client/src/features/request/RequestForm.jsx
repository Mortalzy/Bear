import { useRef, useState } from 'react';
import { UPLOAD_POLICY, validateFileSelection } from '@bear/shared';
import { Icon } from '../../components/Icon.jsx';
import { company } from '../../data/site.js';
import { formatPhone, isCompletePhone } from './phone.js';
import styles from './RequestForm.module.css';

export function RequestForm({ onOpenPrivacy }) {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [phone, setPhone] = useState('');
  const [checked, setChecked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  function addFiles(selected) {
    const next = [...files];
    for (const file of selected) if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    const problems = validateFileSelection(next);
    setErrors(problems); setChecked(false);
    if (!problems.length) setFiles(next);
  }
  function submit(event) {
    event.preventDefault();
    if (!isCompletePhone(phone)) { setErrors(['Введите номер телефона полностью: +7 и 10 цифр.']); return; }
    const problems = validateFileSelection(files);
    setErrors(problems);
    if (!problems.length) setChecked(true);
  }
  return <form className={styles.form} onSubmit={submit} onChange={() => setChecked(false)}>
    <div className={styles.row}><label>Ваше имя<input name="name" autoComplete="name" placeholder="Как к вам обращаться" maxLength={100} required pattern=".*\S.*" /></label><label>Телефон<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={phone} onKeyDown={(event) => {
      const input = event.currentTarget;
      if (event.key === 'Backspace' && input.selectionStart === input.selectionEnd && input.selectionEnd === phone.length && /[^0-9]$/.test(phone)) {
        event.preventDefault(); setPhone(formatPhone(phone.replace(/\D/g, '').slice(0, -1))); setChecked(false);
      }
    }} onChange={(event) => setPhone(formatPhone(event.target.value))} onFocus={() => { if (!phone) setPhone('+7'); }} required aria-describedby="form-errors" /></label></div>
    <label>Email<input name="email" type="email" autoComplete="email" placeholder="mail@company.ru" maxLength={254} required /></label>
    <label>О проекте<textarea name="description" rows={4} placeholder="Что нужно изготовить? Расскажите о задаче, материалах и объёме." maxLength={5000} required /></label>
    <div className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
      <input ref={fileInput} id="project-files" name="files" type="file" multiple accept={UPLOAD_POLICY.extensions.join(',')} onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} aria-describedby="file-help form-errors" className={styles.fileInput} />
      <label htmlFor="project-files" className={styles.uploadLabel}><Icon name="upload" size={23} /><span><strong>Прикрепить файлы</strong><span>или перетащите их сюда</span></span><Icon name="plus" size={20} /></label>
      <p id="file-help">До {UPLOAD_POLICY.maxFiles} файлов · до 50 МБ каждый<br />DWG, DXF, STEP, PDF, JPG</p>
    </div>
    {files.length > 0 && <ul className={styles.files}>{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`}><span>{file.name}<small>{(file.size / 1_000_000).toFixed(2)} МБ</small></span><button type="button" aria-label={`Удалить ${file.name}`} onClick={() => { setFiles(files.filter((_, i) => i !== index)); setErrors([]); setChecked(false); }}><Icon name="close" size={17} /></button></li>)}</ul>}
    <div id="form-errors" role="alert">{errors.map((error) => <p key={error} className={styles.error}>{error}</p>)}</div>
    <label className={styles.consent}><input type="checkbox" required name="consent" /><span>Я ознакомлен(а) с <button type="button" onClick={onOpenPrivacy}>информацией об обработке данных</button></span></label>
    <button type="submit" className={styles.submit}>Проверить заявку<Icon size={21} /></button>
    <p className={styles.mode}>Демонстрационный режим: данные и файлы не отправляются. Контакты компании будут добавлены перед публикацией сайта.</p>
    {checked && <div className={styles.success} role="status"><Icon name="check" size={21} /><div><strong>Всё заполнено верно.</strong><p>Отправка пока не подключена.{company.email ? <> Напишите на <a href={`mailto:${company.email}`}>{company.email}</a>. Файлы нужно приложить к письму вручную.</> : ' Контактный email компании будет добавлен позже.'}</p></div></div>}
  </form>;
}
