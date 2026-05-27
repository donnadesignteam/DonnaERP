import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:28, fontWeight:600, marginBottom:8 }}>Donna Design</h1>
        <p style={{ color:'#86868b', marginBottom:24 }}>ระบบจัดการหลังบ้าน</p>
        <Link href="/dashboard" style={{
          background:'#0071e3', color:'#fff',
          padding:'10px 24px', borderRadius:980,
          textDecoration:'none', fontSize:14, fontWeight:500
        }}>
          เข้าสู่ระบบ →
        </Link>
      </div>
    </div>
  )
}