'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type FabricMeta = {
  color_name: string
  fabric_width: number
  fabric_type: string
  shop_code: string
  shop_name: string
}

const FABRIC_LOOKUP: Record<string, FabricMeta> = {
  'S010': { color_name: 'ครีมขาว', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/01', shop_name: 'Darika (DK)' },
  'D00': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'St160-13', shop_name: 'รุ่งโรจน์' },
  'D038': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'AU004-26', shop_name: 'ออร่า Aura Art' },
  'W17': { color_name: 'เบจน้ำตาล', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101/17', shop_name: 'M&X' },
  'S22': { color_name: 'เบจน้ำตาล', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'รอหาตัวใหม่', shop_name: 'M&X' },
  'S700': { color_name: 'ครีมลาเต้', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/06', shop_name: 'Darika (DK)' },
  'S05': { color_name: 'เทาเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101/5', shop_name: 'M&X' },
  'S18': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'MU101/18', shop_name: 'M&X' },
  'M80': { color_name: 'เทาเข้ม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'BSW-3', shop_name: 'CT store' },
  'S61': { color_name: 'เทาเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'BSW-1', shop_name: 'CT store' },
  'S10': { color_name: 'สีดำ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'COS 18-13', shop_name: 'Cosi' },
  'DS01': { color_name: 'โปร่งลายฝนขาวสว่าง สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-101', shop_name: 'CT store' },
  'DS02': { color_name: 'โปร่งลายฝนขาวนวล สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-102', shop_name: 'CT store' },
  'DS03': { color_name: 'โปร่งเรียบขาวสว่าง สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-104', shop_name: 'CT store' },
  'DS04': { color_name: 'โปร่งเรียบขาวนวล สูงปกติ', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-103', shop_name: 'CT store' },
  'DS05': { color_name: 'Mist Gray โปร่งเทา', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '1S-130', shop_name: 'CT store' },
  'DS06': { color_name: 'โปร่งลายฝนขาวสว่าง สูงพิเศษ', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'OK301-21A', shop_name: 'Sue M' },
  'DS07': { color_name: 'โปร่งลายฝนขาวนวล สูงพิเศษ', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'OK301-21B', shop_name: 'Sue M' },
  'DS08': { color_name: 'โปร่งเรียบหนา Mid-modern', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB21', shop_name: 'จิงจิง' },
  'DS09': { color_name: 'โปร่งเรียบหนาพิเศษ Richy', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB22', shop_name: 'จิงจิง' },
  'DS10': { color_name: 'โปร่งลาย Linen', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB58', shop_name: 'จิงจิง' },
  'DS11': { color_name: 'โปร่งหนา Butter Cup linen Pie', fabric_width: 3.20, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: 'AB41', shop_name: 'จิงจิง' },
  'H01': { color_name: 'ครีม', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'G471', shop_name: 'เดอะแกรน The Grand' },
  'HJJ-6': { color_name: 'ครีมอ่อน', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '820-1', shop_name: 'จิงจิง' },
  'HJJ-7': { color_name: 'ครีมน้ำตาล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-6', shop_name: 'จิงจิง' },
  'HJJ-8': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-7', shop_name: 'จิงจิง' },
  'H222': { color_name: 'เเบจน้ำตาล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '1018-5', shop_name: 'จิงจิง' },
  'H99': { color_name: 'เทาเบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '820-3', shop_name: 'โกลเฮ้าส์ Gold house' },
  'M11': { color_name: 'แมคคาเดเมียแกมเขียว', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'ha189', shop_name: 'โกลเฮ้าส์ Gold house' },
  'A11': { color_name: 'แมคคาเดเมียแกมครีมขาว', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'ha188', shop_name: 'โกลเฮ้าส์ Gold house' },
  'S01': { color_name: 'ครีมมินิมอล', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'DD-1', shop_name: 'จิงจิง' },
  'M20': { color_name: 'เบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'DD-2', shop_name: 'จิงจิง' },
  'S581': { color_name: 'ขาวครีมติดเนื้อ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: '5008-1', shop_name: 'เควี KV' },
  'M14': { color_name: 'นู๊ดเบจ', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ', shop_code: 'PC-A-33', shop_name: 'Pro textile' },
  'KW5-1': { color_name: 'ขาวมุก วิ้งเกาหลี', fabric_width: 3.20, fabric_type: 'DIMOUT สูงพิเศษ วิ้งเกาหลี', shop_code: 'CX5000-1', shop_name: 'CX' },
  'HB81': { color_name: 'เทาเบจน้ำตาล', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-1', shop_name: 'จิงจิง' },
  'HB16': { color_name: 'ขาวออฟไวท์', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-3', shop_name: 'จิงจิง' },
  'HB82': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-2', shop_name: 'จิงจิง' },
  'HB83': { color_name: 'เทาอ่อน', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-5', shop_name: 'จิงจิง' },
  'HB85': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: '8186-4', shop_name: 'จิงจิง' },
  'HB88': { color_name: 'ขาวครีม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'KK1', shop_name: 'จิงจิง' },
  'HB87': { color_name: 'ลินินหม่นขาว', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-22', shop_name: 'Asia fabric' },
  'SHB91': { color_name: 'Cotton คอตต้อน', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3401', shop_name: 'Amazing อเมซิ่ง' },
  'SHB92': { color_name: 'Cloud Whisper เทาเมฆ', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3406', shop_name: 'Amazing อเมซิ่ง' },
  'SHB93': { color_name: 'Stone Echo เทาเข้ม', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3407', shop_name: 'Amazing อเมซิ่ง' },
  'SHB94': { color_name: 'brich brown', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3405', shop_name: 'Amazing อเมซิ่ง' },
  'SHB97': { color_name: 'Linen Beige ลินินเบจ', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3403', shop_name: 'Amazing อเมซิ่ง' },
  'SHB98': { color_name: 'Oatmeal โอ้ตมิล', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3402', shop_name: 'Amazing อเมซิ่ง' },
  'SHB99': { color_name: 'Mocha Stone ม่อคค่า', fabric_width: 3.40, fabric_type: 'SUPER HIGH BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AZ3404', shop_name: 'Amazing อเมซิ่ง' },
  'HB-R1': { color_name: 'มาชเมลโล่ว', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-4', shop_name: 'จิงจิง' },
  'HB-R2': { color_name: 'น้ำตาลนู๊ด', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-7', shop_name: 'จิงจิง' },
  'HB-R3': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-2', shop_name: 'จิงจิง' },
  'HB-R4': { color_name: 'เทาเข้ม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-5', shop_name: 'จิงจิง' },
  'KB-1': { color_name: 'น้ำตาลเทา', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-1/521-2', shop_name: 'CT store' },
  'KB-2': { color_name: 'ขาว', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-2', shop_name: 'CT store' },
  'KB-3': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-3', shop_name: 'CT store' },
  'KB-4': { color_name: 'เทาขาว', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-4', shop_name: 'CT store' },
  'KB-5': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-5', shop_name: 'CT store' },
  'KB-6': { color_name: 'น้ำเงิน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-6', shop_name: 'CT store' },
  'KB-7': { color_name: 'เทาอ่อน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-7', shop_name: 'CT store' },
  'KB-8': { color_name: 'เทาน้ำเงิน', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-8', shop_name: 'CT store' },
  'KB-9': { color_name: 'เทากลาง', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-9', shop_name: 'CT store' },
  'KB-10': { color_name: 'เทาเข้มกลาง', fabric_width: 2.80, fabric_type: 'BLACKOUT กาดล้านเมือง หน้าหลังเหมือนกัน', shop_code: 'ASW-10', shop_name: 'CT store' },
  'A1': { color_name: 'ครีมเบจ', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/05', shop_name: 'Darika (DK)' },
  'M21': { color_name: 'เบจอ่อน', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'AU004-27', shop_name: 'ออร่า Aura Art' },
  'J-DD13': { color_name: 'เทาเมฆ', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังไม่เหมือนกัน', shop_code: '1021-3', shop_name: 'จิงจิง' },
  'MS01': { color_name: '-', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ เรียบ', shop_code: '8188-1', shop_name: 'จิงจิง' },
  'B82': { color_name: 'เทาเมฆ', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-10', shop_name: 'จิงจิง' },
  'B16': { color_name: 'ขาวครีม', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-16', shop_name: 'จิงจิง' },
  'B85': { color_name: 'เทาเข้ม', fabric_width: 2.80, fabric_type: 'BLACKOUT สูงปกติ หน้าหลังไม่เหมือนกัน', shop_code: '520-29', shop_name: 'จิงจิง' },
  'DS12': { color_name: 'โปร่ง "สีทอง"', fabric_width: 2.80, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '-', shop_name: 'จิงจิง' },
  'DS13': { color_name: 'โปร่ง"เรียบ"ขาวนวล สูงปกติ', fabric_width: 3.00, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '301-22B', shop_name: 'Cosi' },
  'DS14': { color_name: 'โปร่ง"เรียบ"ขาวสว่าง สูงปกติ', fabric_width: 3.00, fabric_type: 'SHEER ผ้าโปร่ง', shop_code: '301-22A', shop_name: 'Cosi' },
  'HB24': { color_name: 'ขาวครีม', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-24', shop_name: 'Asia fabric' },
  'HB25': { color_name: 'อัลมอนด์', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-25', shop_name: 'Asia fabric' },
  'HB26': { color_name: 'ซินนาม่อน', fabric_width: 3.20, fabric_type: 'BLACKOUT สูงพิเศษ หน้าหลังเหมือนกัน', shop_code: 'AF23-26', shop_name: 'Asia fabric' },
  'HUNTER GREEN': { color_name: 'สีเขียว', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'DK85/16', shop_name: 'Darika (DK)' },
  'S40': { color_name: 'butter ครีมเนย', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'ART06-40', shop_name: 'ออร่า Aura Art' },
  'S42': { color_name: 'Navy gray เทากรม', fabric_width: 2.80, fabric_type: 'DIMOUT สูงปกติ', shop_code: 'ART06-42', shop_name: 'ออร่า Aura Art' },
}

const SHOP_LOOKUP: Record<string, { fabric_code: string; color_name: string; fabric_width: number; fabric_type: string; shop_name: string }> =
  Object.fromEntries(
    Object.entries(FABRIC_LOOKUP)
      .filter(([, v]) => v.shop_code && v.shop_code !== '-')
      .map(([k, v]) => [v.shop_code.toUpperCase(), {
        fabric_code: k, color_name: v.color_name,
        fabric_width: v.fabric_width, fabric_type: v.fabric_type, shop_name: v.shop_name,
      }])
  )

type StockItem = {
  id: string
  fabric_code: string
  color_name: string
  fabric_width: number | null
  fabric_type: string
  shop_code: string
  shop_name: string
  roll_count: number
  unused_rolls: number
  in_use_rolls: number
  status: string
  updated_at: string
}

const getStatus = (n: number) =>
  n === 0 ? 'ของหมด' : n <= 3 ? 'ควรสั่ง' : n <= 6 ? 'ของเหลือน้อย' : 'ปกติ'

const statusStyle = (s: string): React.CSSProperties => {
  if (s === 'ของหมด') return { background: 'rgba(220,38,38,0.08)', color: 'var(--red)' }
  if (s === 'ควรสั่ง') return { background: 'rgba(255,159,10,0.1)', color: '#b45309' }
  if (s === 'ของเหลือน้อย') return { background: 'rgba(255,204,0,0.12)', color: '#92600a' }
  return { background: 'rgba(52,199,89,0.1)', color: '#1a7f37' }
}

const empty = (): Omit<StockItem, 'id' | 'updated_at'> => ({
  fabric_code: '', color_name: '', fabric_width: null, fabric_type: '',
  shop_code: '', shop_name: '', roll_count: 0, unused_rolls: 0, in_use_rolls: 0, status: 'ปกติ',
})

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--shadow)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 13px',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  fontFamily: 'inherit',
  transition: 'border 0.15s, box-shadow 0.15s',
}

const autoInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'rgba(52,199,89,0.06)',
  border: '1px solid rgba(52,199,89,0.35)',
  color: 'var(--ink)',
}

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; data: Partial<StockItem> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'unused_rolls' | 'in_use_rolls'; val: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('stock').select('*').order('fabric_code')
    if (err) setError(`โหลดข้อมูลไม่ได้: ${err.message}`)
    setItems((data ?? []) as StockItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setAutoFilled(false)
    setModal({ mode: 'add', data: empty() })
  }

  const openEdit = (item: StockItem) => {
    setAutoFilled(false)
    setModal({ mode: 'edit', data: { ...item } })
  }

  const handleShopCode = (code: string) => {
    const info = SHOP_LOOKUP[code.trim().toUpperCase()]
    if (info) {
      setAutoFilled(true)
      setModal(m => m ? { ...m, data: { ...m.data, shop_code: code, ...info } } : null)
    } else {
      setAutoFilled(false)
      setModal(m => m ? { ...m, data: { ...m.data, shop_code: code } } : null)
    }
  }

  const save = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    const { fabric_code, color_name, fabric_width, fabric_type, shop_code, shop_name, roll_count, unused_rolls, in_use_rolls, status } = modal.data
    const payload = {
      fabric_code, color_name, fabric_width: fabric_width ?? null,
      fabric_type, shop_code, shop_name,
      roll_count: Number(roll_count),
      unused_rolls: Number(unused_rolls ?? 0),
      in_use_rolls: Number(in_use_rolls ?? 0),
      status: getStatus(Number(roll_count ?? 0)),
      updated_at: new Date().toISOString(),
    }
    let err
    if (modal.mode === 'add') {
      const res = await supabase.from('stock').insert(payload)
      err = res.error
    } else {
      const res = await supabase.from('stock').update(payload).eq('id', modal.data.id)
      err = res.error
    }
    setSaving(false)
    if (err) {
      setError(`บันทึกไม่สำเร็จ: ${err.message}`)
    } else {
      setModal(null)
      load()
    }
  }

  const saveInline = async () => {
    if (!inlineEdit) return
    await supabase.from('stock').update({ [inlineEdit.field]: Number(inlineEdit.val) }).eq('id', inlineEdit.id)
    setInlineEdit(null)
    load()
  }

  const del = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    await supabase.from('stock').delete().eq('id', id)
    load()
  }

  const filtered = items.filter(i =>
    i.fabric_code?.toLowerCase().includes(search.toLowerCase()) ||
    i.color_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.shop_code?.toLowerCase().includes(search.toLowerCase()) ||
    i.shop_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.fabric_type?.toLowerCase().includes(search.toLowerCase())
  )

  const set = (k: string, v: string | number | null) =>
    setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : null)

  const closeMenu = () => { setMenuOpen(null); setMenuRect(null) }

  return (
    <div>
      {menuOpen && <div onClick={closeMenu} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', fontFamily: 'inherit' }}>สต็อก</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>{items.length} รายการ</p>
        </div>
        <button onClick={openAdd}
          style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,122,255,0.3), 0 4px 14px rgba(0,122,255,0.2)', fontFamily: 'inherit' }}>
          + เพิ่มรายการ
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(255,59,48,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16 }}>✕</button>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา รหัสผ้า / ชื่อสี / รหัสร้าน / ร้าน / ลักษณะผ้า…"
        style={{ ...inputStyle, marginBottom: 16 }} />

      <div style={{ ...cardStyle, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧵</div>
            ไม่มีข้อมูลสต็อก
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFAFA' }}>
                {['รหัสผ้า', 'ชื่อสี', 'หน้าผ้า', 'ลักษณะผ้า', 'รหัสร้าน', 'ร้าน', 'จำนวนทั้งหมด', 'ยังไม่ได้เปิดใช้', 'เปิดใช้', 'สถานะ', 'วันอัพเดต', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '13px 14px', color: 'var(--ink-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{item.fabric_code}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink)' }}>{item.color_name || '-'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                    {item.fabric_width != null ? `${item.fabric_width} ม.` : '-'}
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink-3)', maxWidth: 180 }}>{item.fabric_type || '-'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{item.shop_code || '-'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--ink)' }}>{item.shop_name || '-'}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, color: item.roll_count <= 2 ? 'var(--red)' : 'var(--ink)' }}>{item.roll_count}</span>
                  </td>
                  {(['unused_rolls', 'in_use_rolls'] as const).map(field => (
                    <td key={field} style={{ padding: '8px 14px', textAlign: 'center' }}>
                      {inlineEdit?.id === item.id && inlineEdit.field === field ? (
                        <input
                          type="number"
                          autoFocus
                          value={inlineEdit.val}
                          onChange={e => setInlineEdit(prev => prev ? { ...prev, val: e.target.value } : null)}
                          onBlur={saveInline}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                          style={{ border: 'none', borderBottom: '1px solid var(--blue)', background: 'transparent', fontSize: 13, width: 48, outline: 'none', textAlign: 'center', padding: '2px 0', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <div
                          onClick={e => { e.stopPropagation(); setInlineEdit({ id: item.id, field, val: String(item[field] ?? 0) }) }}
                          style={{ cursor: 'text', color: 'var(--ink)', minHeight: 20 }}
                        >
                          {item[field] ?? 0}
                        </div>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12, borderRadius: 20, padding: '3px 10px', fontWeight: 500, ...statusStyle(getStatus(item.roll_count)) }}>
                      {getStatus(item.roll_count)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--ink-4)', fontSize: 11 }}>
                    {item.updated_at ? (
                      <div>
                        <div>{new Date(item.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                        <div>{new Date(item.updated_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (menuOpen === item.id) { closeMenu() } else { setMenuOpen(item.id); setMenuRect(rect) } }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: menuOpen === item.id ? 'var(--bg)' : 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', letterSpacing: 1 }}>
                      ···
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Global 3-dot dropdown */}
      {menuOpen && menuRect && (() => {
        const item = filtered.find(i => i.id === menuOpen)
        if (!item) return null
        return (
          <div style={{ position: 'fixed', top: menuRect.bottom + 2, right: window.innerWidth - menuRect.right, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 9999, minWidth: 110, overflow: 'hidden' }}>
            <button onClick={() => { openEdit(item); closeMenu() }}
              style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)' }}>
              แก้ไข
            </button>
            <button onClick={() => { del(item.id); closeMenu() }}
              style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: 'var(--red)' }}>
              ลบ
            </button>
          </div>
        )
      })()}

      {/* Modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...cardStyle, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, fontFamily: 'inherit', color: 'var(--ink)' }}>
              {modal.mode === 'add' ? '+ เพิ่มรายการสต็อก' : 'แก้ไขสต็อก'}
            </h2>

            {/* บรรทัดแรก: รหัสผ้าของบริษัท + auto-fill badge */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--ink-3)' }}>รหัสผ้าของบริษัท</label>
                {autoFilled && (
                  <span style={{ fontSize: 11, background: 'rgba(52,199,89,0.12)', color: '#1a7f37', border: '1px solid rgba(52,199,89,0.35)', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>
                    เติมอัตโนมัติ ✓
                  </span>
                )}
              </div>
              <input
                type="text"
                value={String(modal.data.shop_code ?? '')}
                onChange={e => handleShopCode(e.target.value)}
                placeholder=""
                style={inputStyle}
                autoFocus
              />
            </div>

            {/* ร้าน/บริษัท */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>ร้าน/บริษัท</label>
              <input type="text" value={String(modal.data.shop_name ?? '')}
                onChange={e => { setAutoFilled(false); set('shop_name', e.target.value) }}
                style={autoFilled ? autoInputStyle : inputStyle} />
            </div>

            {/* รหัสผ้า */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>รหัสผ้า</label>
              <input type="text" value={String(modal.data.fabric_code ?? '')}
                onChange={e => { setAutoFilled(false); set('fabric_code', e.target.value) }}
                style={autoFilled ? autoInputStyle : inputStyle} />
            </div>

            {/* 2 cols: ชื่อสี + หน้าผ้า */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>ชื่อสี</label>
                <input type="text" value={String(modal.data.color_name ?? '')}
                  onChange={e => { setAutoFilled(false); set('color_name', e.target.value) }}
                  style={autoFilled ? autoInputStyle : inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>หน้าผ้า (ม.)</label>
                <select value={String(modal.data.fabric_width ?? '')}
                  onChange={e => { setAutoFilled(false); set('fabric_width', e.target.value ? Number(e.target.value) : null) }}
                  style={autoFilled ? { ...autoInputStyle, appearance: 'auto' } : { ...inputStyle, appearance: 'auto' }}>
                  <option value="">-</option>
                  <option value="2.8">2.80</option>
                  <option value="3.2">3.20</option>
                  <option value="3.4">3.40</option>
                </select>
              </div>
            </div>

            {/* ลักษณะผ้า */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>ลักษณะผ้า</label>
              <input type="text" value={String(modal.data.fabric_type ?? '')}
                onChange={e => { setAutoFilled(false); set('fabric_type', e.target.value) }}
                style={autoFilled ? autoInputStyle : inputStyle} />
            </div>

            {/* 3 cols: จำนวนทั้งหมด + ยังไม่ได้เปิดใช้ + เปิดใช้ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>จำนวนทั้งหมด</label>
                <input type="number" value={String(modal.data.roll_count ?? 0)}
                  onChange={e => set('roll_count', Number(e.target.value))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>ยังไม่ได้เปิดใช้</label>
                <input type="number" value={String(modal.data.unused_rolls ?? 0)}
                  onChange={e => set('unused_rolls', Number(e.target.value))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>เปิดใช้</label>
                <input type="number" value={String(modal.data.in_use_rolls ?? 0)}
                  onChange={e => set('in_use_rolls', Number(e.target.value))}
                  style={inputStyle} />
              </div>
            </div>

            {/* สถานะ (computed) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>สถานะ</label>
              <div style={{ padding: '10px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(142,142,147,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, borderRadius: 20, padding: '3px 10px', fontWeight: 500, ...statusStyle(getStatus(Number(modal.data.roll_count ?? 0))) }}>
                  {getStatus(Number(modal.data.roll_count ?? 0))}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>คำนวณจากจำนวนทั้งหมด</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(142,142,147,0.08)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                ยกเลิก
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,122,255,0.3)', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
