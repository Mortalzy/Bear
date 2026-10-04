export function mediaUrl(path) {
  return `/images/${path.split('/').map(encodeURIComponent).join('/')}`;
}
