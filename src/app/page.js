'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [message, setMessage] = useState('시작...')

  useEffect(() => {
    async function test() {
      setMessage('연결 시도 중...')
      
      // 환경변수 확인
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      console.log('Supabase URL:', url)
      console.log('API Key 존재:', !!key)
      
      if (!url || !key) {
        setMessage('❌ 환경변수가 설정되지 않았습니다!')
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('daily_records')
          .select('*')
          .limit(1)
        
        if (error) {
          setMessage('❌ 에러: ' + error.message)
          console.error('Supabase error:', error)
        } else {
          setMessage('✅ 연결 성공! 데이터: ' + data.length + '개')
        }
      } catch (err) {
        setMessage('❌ 예외 발생: ' + err.message)
        console.error('Exception:', err)
      }
    }
    
    test()
  }, [])

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
      <h1>리틀 라이프 - Supabase 연결 테스트</h1>
      <h2>{message}</h2>
    </div>
  )
}