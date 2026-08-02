import {LibraryEntry, ManifestChapter} from '@core/models/library.model';
import {mergeSeriesEntry} from './offline-storage.service';

function chapter(n: number, status: ManifestChapter['status'] = 'success', pages = 12): ManifestChapter {
  const id = `ch-${String(n).padStart(3, '0')}`;
  return {
    id,
    number: n,
    title: `Chapter ${String(n).padStart(3, '0')}`,
    pages,
    path: `chapters/${String(n).padStart(3, '0')}`,
    status,
  };
}

function entry(chapters: ManifestChapter[], over: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    spec_version: 1,
    id: 'reformation-of-the-deadbeat-noble',
    title: 'Reformation of the Deadbeat Noble',
    author: 'Someone',
    downloaded_at: '2026-08-01T10:00:00Z',
    chapters,
    sizeBytes: 1000,
    ...over,
  };
}

describe('mergeSeriesEntry', () => {

  it('unions chapters from separate downloads and orders them by number', () => {
    const existing = entry([chapter(1), chapter(2), chapter(3)]);
    const incoming = entry([chapter(5), chapter(4)], {sizeBytes: 500});

    const merged = mergeSeriesEntry(existing, incoming);

    expect(merged.chapters.map(c => c.number)).toEqual([1, 2, 3, 4, 5]);
    expect(merged.sizeBytes).toBe(1500);
  });

  it('upgrades a chapter when the new archive downloaded it successfully', () => {
    const existing = entry([chapter(1, 'incomplete', 8)]);
    const incoming = entry([chapter(1, 'success', 12)]);

    const merged = mergeSeriesEntry(existing, incoming);

    expect(merged.chapters.length).toBe(1);
    expect(merged.chapters[0].status).toBe('success');
    expect(merged.chapters[0].pages).toBe(12);
  });

  it('does not downgrade a chapter that already imported cleanly', () => {
    const existing = entry([chapter(1, 'success', 12)]);
    const incoming = entry([chapter(1, 'failed', 0)]);

    const merged = mergeSeriesEntry(existing, incoming);

    expect(merged.chapters[0].status).toBe('success');
    expect(merged.chapters[0].pages).toBe(12);
  });

  it('keeps the reading position across a re-import', () => {
    const existing = entry([chapter(1)], {
      lastReadChapterId: 'ch-001',
      lastReadPage: 7,
      lastReadAt: '2026-08-01T12:00:00Z',
    });
    const incoming = entry([chapter(2)]);

    const merged = mergeSeriesEntry(existing, incoming);

    expect(merged.lastReadChapterId).toBe('ch-001');
    expect(merged.lastReadPage).toBe(7);
    expect(merged.lastReadAt).toBe('2026-08-01T12:00:00Z');
  });

  it('takes fresh metadata but never regresses a field the new archive omits', () => {
    const existing = entry([chapter(1)], {cover: 'cover.webp', rating: 4.5, description: 'old'});
    const incoming = entry([chapter(2)], {description: 'new', downloaded_at: '2026-08-02T10:00:00Z'});

    const merged = mergeSeriesEntry(existing, incoming);

    expect(merged.description).toBe('new');
    expect(merged.downloaded_at).toBe('2026-08-02T10:00:00Z');
    expect(merged.cover).toBe('cover.webp');
    expect(merged.rating).toBe(4.5);
  });
});
