'use client'

import dynamic from 'next/dynamic'

const AuthForm = dynamic(
  () => import('@/components/auth/AuthForm').then((m) => ({ default: () => <m.AuthForm mode="login" /> })),
  { ssr: false }
)

export default function LoginPage() {
  return <AuthForm />
}
