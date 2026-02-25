// Utility to extract filename from Content-Disposition header
export function getFilenameFromContentDisposition(contentDisposition: string): string {
  if (!contentDisposition) return '';
  const match = contentDisposition.match(/filename="?([^";]+)"?/);
  return match && match[1] ? match[1] : '';
}

// Utility to download a blob with a given filename
export function downloadBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}

