'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Navigation.module.css'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/installation', label: 'Installation' },
  { href: '/api', label: 'API Reference' },
  { href: '/codegen', label: 'Code Generation' },
  { href: '/async', label: 'Async Patterns' },
  { href: '/rpc', label: 'RPC' },
  { href: '/examples', label: 'Examples' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <Link href="/">capnp-rust</Link>
      </div>
      <ul className={styles.links}>
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={pathname === item.href ? styles.active : ''}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.external}>
        <a href="https://docs.rs/capnp" target="_blank" rel="noopener noreferrer">
          docs.rs
        </a>
        <a href="https://github.com/zap-protocol/capnp-rust" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
    </nav>
  )
}
