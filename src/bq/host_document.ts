const MONACO_SELECTOR = '.monaco-editor';

/**
 * Ar URL yra BigQuery konsolės puslapis.
 */
export function isBigQueryPage(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      url.hostname === 'console.cloud.google.com' &&
      url.pathname.startsWith('/bigquery')
    );
  } catch {
    return /console\.cloud\.google\.com\/bigquery/i.test(href);
  }
}

/**
 * Rekursyviai ieško dokumento su Monaco redaktoriumi (įskaitant iframe).
 */
function findDocumentWithMonaco(doc: Document): Document | null {
  if (doc.querySelector(MONACO_SELECTOR)) {
    return doc;
  }

  const iframes = Array.from(doc.querySelectorAll('iframe'));

  for (const iframe of iframes) {
    try {
      const childDoc = iframe.contentDocument;
      if (!childDoc) {
        continue;
      }

      const found = findDocumentWithMonaco(childDoc);
      if (found) {
        return found;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Didžiausio matomo same-origin iframe dokumentas (GCP app shell).
 */
function findLargestVisibleIframeDocument(doc: Document): Document | null {
  let bestDoc: Document | null = null;
  let bestArea = 0;

  const visit = (current: Document): void => {
    const iframes = Array.from(current.querySelectorAll('iframe'));

    for (const iframe of iframes) {
      try {
        const childDoc = iframe.contentDocument;
        if (!childDoc) {
          continue;
        }

        const rect = iframe.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (area > bestArea) {
          bestArea = area;
          bestDoc = childDoc;
        }

        visit(childDoc);
      } catch {
        continue;
      }
    }
  };

  visit(doc);

  return bestArea > 200_000 ? bestDoc : null;
}

/**
 * Dokumentas, į kurį reikia dėti panelę ir iš kurio skaityti Monaco.
 */
export function findBigQueryHostDocument(): Document | null {
  const monacoDoc = findDocumentWithMonaco(document);
  if (monacoDoc) {
    return monacoDoc;
  }

  if (isBigQueryPage(window.location.href)) {
    const shellDoc = findLargestVisibleIframeDocument(document);
    if (shellDoc?.body) {
      return shellDoc;
    }

    if (document.body) {
      return document;
    }
  }

  if (document.body && window.top && document !== window.top.document) {
    return document;
  }

  const nestedShell = findLargestVisibleIframeDocument(document);
  return nestedShell?.body ? nestedShell : null;
}
