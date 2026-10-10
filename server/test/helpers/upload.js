// Stream real multipart bytes without allocating the complete 200 MB upload in RAM.
export function postUpload(url, sizes) {
  const boundary = 'bear-upload-boundary';
  const fields = {
    name: 'Иван',
    phone: '+7 (999) 123-45-67',
    email: 'ivan@example.com',
    description: 'Корпус катера',
    consent: 'true',
  };

  async function* body() {
    for (const [name, value] of Object.entries(fields)) {
      yield Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    }
    const signature = Buffer.from('%PDF-1.7\n');
    const chunk = Buffer.alloc(65_536);
    for (const [index, size] of sizes.entries()) {
      yield Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${index}.pdf"\r\nContent-Type: application/pdf\r\n\r\n`);
      yield signature;
      let remaining = size - signature.length;
      while (remaining > 0) {
        const length = Math.min(chunk.length, remaining);
        yield chunk.subarray(0, length);
        remaining -= length;
      }
      yield Buffer.from('\r\n');
    }
    yield Buffer.from(`--${boundary}--\r\n`);
  }

  return fetch(url + '/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
    body: body(),
    duplex: 'half',
  });
}
