import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars, opptrixTokens } from '../../theme/tokens'
import { LIBRARY_SHELF_ACCEPT } from './libraryShelfFiles'

const useStyles = makeStyles({
  zone: {
    margin: '8px 12px 6px',
    minHeight: '36px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    border: `1px dashed ${opptrixCssVars.borderStrong}`,
    borderRadius: opptrixTokens.radiusMd,
    backgroundColor: 'transparent',
    color: opptrixCssVars.textSecondary,
    fontSize: 'var(--opptrix-font-sm)',
    lineHeight: 1.4,
    cursor: 'pointer',
    ':hover': { backgroundColor: opptrixCssVars.surfaceHover },
  },
  over: {
    backgroundColor: opptrixCssVars.accentSoft,
  },
})

export function LibraryShelfAdd({ busy, onAdd }: { busy: string | null; onAdd: (files: File[]) => void }) {
  const s = useStyles()
  const onDrop = useCallback((files: File[]) => {
    if (files.length > 0) onAdd(files)
  }, [onAdd])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: busy !== null,
    noPaste: true,
    noDragEventsBubbling: true,
  })
  return (
    <div
      {...getRootProps({
        className: mergeClasses(s.zone, isDragActive && s.over, 'opptrix-focusable'),
        role: 'button',
      })}
    >
      <input {...getInputProps({ accept: LIBRARY_SHELF_ACCEPT, 'aria-hidden': true, tabIndex: -1 })} />
      {isDragActive ? '松开即可加入' : '拖入或点击添加'}
    </div>
  )
}
