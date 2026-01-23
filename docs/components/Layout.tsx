import Navigation from './Navigation'
import styles from './Layout.module.css'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <>
      <Navigation />
      <main className={styles.main}>
        <article className={styles.content}>
          {children}
        </article>
      </main>
    </>
  )
}
