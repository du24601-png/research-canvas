import { defaultSchema } from 'hast-util-sanitize'
import type { Schema } from 'hast-util-sanitize'

const OPPTRIX_MD_CLASS = /^opptrix-md-/

/** Safe HTML subset for assistant markdown (underline, semantic tones, media). */
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'u',
    'ins',
    'kbd',
    'video',
    'audio',
    'source',
  ],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['className', OPPTRIX_MD_CLASS],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ['className', OPPTRIX_MD_CLASS],
    ],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ['className', /^language-/],
    ],
    img: [
      ...(defaultSchema.attributes?.img ?? []),
      'src',
      'alt',
      'title',
      'width',
      'height',
      'loading',
    ],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'href',
      'title',
      'target',
      'rel',
    ],
    video: [
      'src',
      'controls',
      'preload',
      'poster',
      'width',
      'height',
      ['className', OPPTRIX_MD_CLASS],
    ],
    audio: [
      'src',
      'controls',
      'preload',
      ['className', OPPTRIX_MD_CLASS],
    ],
    source: ['src', 'type'],
  },
  protocols: {
    ...defaultSchema.protocols,
    /** opptrix-doc：文档页码引用，仅 a[href]；具体格式由 doc-citation/docCitationLink 严格校验 */
    href: [...(defaultSchema.protocols?.href ?? []), 'http', 'https', 'opptrix-doc'],
    src: [...(defaultSchema.protocols?.src ?? []), 'http', 'https'],
  },
}
