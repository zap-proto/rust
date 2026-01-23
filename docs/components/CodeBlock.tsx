import styles from './CodeBlock.module.css'

interface CodeBlockProps {
  children: string
  language?: string
  filename?: string
}

export default function CodeBlock({ children, language = 'rust', filename }: CodeBlockProps) {
  return (
    <div className={styles.container}>
      {filename && <div className={styles.filename}>{filename}</div>}
      <pre className={styles.pre}>
        <code className={`language-${language}`}>{children}</code>
      </pre>
    </div>
  )
}
