export const UPLOAD_POLICY = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 25_000_000,
  maxTotalBytes: 200_000_000,
  extensions: Object.freeze(['.dwg', '.dxf', '.step', '.pdf', '.jpg']),
});

// Client-side feedback only; the server enforces actual byte limits and file signatures.
export function validateFileSelection(files) {
  if (!Array.isArray(files)) return ['Некорректный список файлов.'];
  if (files.length > UPLOAD_POLICY.maxFiles) {
    return ['Можно прикрепить не больше ' + UPLOAD_POLICY.maxFiles + ' файлов.'];
  }
  const errors = [];
  let total = 0;
  for (const file of files) {
    if (!file || typeof file.name !== 'string' ||
        !Number.isSafeInteger(file.size) || file.size < 0) {
      errors.push('Некорректные сведения о файле.');
      continue;
    }
    const name = file.name;
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 ? name.slice(dot).toLowerCase() : '';
    if (!UPLOAD_POLICY.extensions.includes(extension)) {
      errors.push('Недопустимый формат: ' + name);
    }
    if (file.size === 0) errors.push('Файл пуст: ' + name);
    if (file.size > UPLOAD_POLICY.maxFileBytes) {
      errors.push('Файл больше 25 МБ: ' + name);
    }
    total += file.size;
  }
  if (total > UPLOAD_POLICY.maxTotalBytes) errors.push('Общий размер файлов больше 200 МБ.');
  return [...new Set(errors)];
}
