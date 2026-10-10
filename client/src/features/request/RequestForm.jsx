import { useEffect, useRef, useState } from 'react';
import { UPLOAD_POLICY, validateFileSelection } from '@bear/shared';
import { Icon } from '../../components/Icon.jsx';
import { formatPhone, isCompletePhone } from './phone.js';
import styles from './RequestForm.module.css';

export function RequestForm() {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const [configuration, setConfiguration] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Configuration unavailable');
        return response.json();
      })
      .then(setConfiguration)
      .catch((error) => {
        if (error.name !== 'AbortError') setConfiguration({ requestsEnabled: false });
      });
    return () => controller.abort();
  }, []);

  function addFiles(selected) {
    if (!configuration?.requestsEnabled || sending) return;
    const next = [...files];
    for (const file of selected) {
      if (
        !next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified
        )
      ) {
        next.push(file);
      }
    }
    const problems = validateFileSelection(next);
    setErrors(problems);
    setSent(false);
    if (!problems.length) setFiles(next);
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!configuration?.requestsEnabled || sending) return;
    const data = new FormData(form);
    if (data.get('consent') !== 'true') {
      setErrors(['Подтвердите согласие на обработку персональных данных.']);
      return;
    }

    if (!isCompletePhone(phone)) {
      setErrors(['Введите номер телефона полностью: +7 и 10 цифр.']);
      return;
    }

    const problems = validateFileSelection(files);
    setErrors(problems);
    if (problems.length) return;

    data.delete('files');
    data.set('consentRevision', configuration.privacy.revision);
    for (const file of files) data.append('files', file);

    setSending(true);
    try {
      const response = await fetch('/api/requests', {
        method: 'POST', body: data,
        headers: { 'X-Bear-Consent': configuration.privacy.revision },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Не удалось отправить заявку.');
      }
      setSent(result.id);
      setFiles([]);
      form.reset();
      setPhone('');
    } catch (error) {
      setErrors([
        error.message || 'Не удалось связаться с сервером. Повторите попытку.',
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      onChange={() => setSent(false)}
    >
      {!configuration?.requestsEnabled && (
        <p className={styles.mode} role="status">
          {configuration ? 'Приём заявок через сайт пока отключён. Связаться с нами можно по контактам рядом.' : 'Проверяем доступность формы…'}
        </p>
      )}
      <fieldset className={styles.fields} disabled={!configuration?.requestsEnabled || sending}>
        <div className={styles.row}>
          <label>
            Ваше имя
            <input
              name="name"
              autoComplete="name"
              placeholder="Как к вам обращаться"
              maxLength={100}
              required
              pattern=".*\S.*"
            />
          </label>
          <label>
            Телефон
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 (___) ___-__-__"
              value={phone}
              onKeyDown={(event) => {
                const input = event.currentTarget;
                if (
                  event.key === 'Backspace' &&
                  input.selectionStart === input.selectionEnd &&
                  input.selectionEnd === phone.length &&
                  /[^0-9]$/.test(phone)
                ) {
                  event.preventDefault();
                  setPhone(formatPhone(phone.replace(/\D/g, '').slice(0, -1)));
                  setSent(false);
                }
              }}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              onFocus={() => {
                if (!phone) setPhone('+7');
              }}
              required
              aria-describedby="form-errors"
            />
          </label>
        </div>

        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="mail@company.ru"
            maxLength={254}
            required
          />
        </label>

        <label>
          О проекте
          <textarea
            name="description"
            rows={4}
            placeholder="Что нужно изготовить? Расскажите о задаче, материалах и объёме."
            maxLength={5000}
            required
          />
        </label>

        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <input
            ref={fileInput}
            id="project-files"
            name="files"
            type="file"
            multiple
            accept={UPLOAD_POLICY.extensions.join(',')}
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []));
              event.target.value = '';
            }}
            aria-describedby="file-help form-errors"
            className={styles.fileInput}
          />
          <label htmlFor="project-files" className={styles.uploadLabel}>
            <Icon name="upload" size={23} />
            <span>
              <strong>Прикрепить файлы</strong>
              <span>или перетащите их сюда</span>
            </span>
            <Icon name="plus" size={20} />
          </label>
          <p id="file-help">
            До {UPLOAD_POLICY.maxFiles} файлов · каждый до 25 МБ · всего до 18 МБ
            <br />
            DWG, DXF, STEP, PDF, JPG
          </p>
        </div>

        <p className={styles.mode}>
          Прикладывайте только материалы проекта. Не отправляйте паспортные документы,
          сведения о здоровье или персональные данные других людей.
        </p>

        {files.length > 0 && (
          <ul className={styles.files}>
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}`}>
                <span>
                  {file.name}
                  <small>{(file.size / 1_000_000).toFixed(2)} МБ</small>
                </span>
                <button
                  type="button"
                  aria-label={`Удалить ${file.name}`}
                  onClick={() => {
                    setFiles(files.filter((_, i) => i !== index));
                    setErrors([]);
                    setSent(false);
                  }}
                >
                  <Icon name="close" size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div id="form-errors" role="alert">
          {errors.map((error) => (
            <p key={error} className={styles.error}>
              {error}
            </p>
          ))}
        </div>

        <label className={styles.consent}>
          <input type="checkbox" required name="consent" value="true" />
          <span>
            Даю <a href="/consent" target="_blank" rel="noopener noreferrer">согласие на обработку персональных данных</a>
            {' '}для рассмотрения моей заявки и связи со мной.
          </span>
        </label>

        <p className={styles.mode}>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Политика обработки персональных данных</a>.
          {' '}Отозвать согласие можно по email, указанному в документах.
        </p>

        <button type="submit" className={styles.submit} disabled={sending}>
          {sending ? 'Отправляем…' : 'Отправить заявку'}
          <Icon size={21} />
        </button>
      </fieldset>

      {sent && (
        <div className={styles.success} role="status">
          <Icon name="check" size={21} />
          <div>
            <strong>Заявка отправлена.</strong>
            <p>Мы свяжемся с вами по указанным контактам.</p>
            <p>Номер заявки: {sent}. Сохраните его для обращений по данным.</p>
          </div>
        </div>
      )}
    </form>
  );
}
