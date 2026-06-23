// รายชื่อพนักงาน + ตรรกะแผนกผลิต/สถานะ (ใช้ร่วมกันระหว่างหน้าปฏิทินลา, ออเดอร์, และหน้าสแกน QR)

export type Employee = { code: string; realName: string; nickname: string; role: string; dept: string }

export const EMPLOYEES: Employee[] = [
  { code:'DN001', realName:'ฮันนา เจิง', nickname:'ยุน', role:'ผู้บริหาร', dept:'ธุรการ' },
  { code:'DN002', realName:'ภานุพงศ์ ปิดเมือง', nickname:'สู้', role:'ผู้จัดการทั่วไป', dept:'ธุรการ' },
  { code:'DN003', realName:'จันทร์แก้ว สลีสองสม', nickname:'ดาว', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN004', realName:'เกษมณี แสนคำ', nickname:'ยุ้ย', role:'ผู้จัดการฝ่ายผลิต', dept:'ปฏิบัติการ' },
  { code:'DN005', realName:'ปริญดา กายสิทธิ์', nickname:'น้าส้ม', role:'ผู้จัดการร้าน', dept:'ปฏิบัติการ' },
  { code:'DN006', realName:'ลู ซา ลิง', nickname:'ตุ๊ดตู่', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN007', realName:'ธัญณิชา วงค์กาอินทร์', nickname:'กุ้ง', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN008', realName:'แสงดาว ลีลี', nickname:'แสงดาว', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN009', realName:'ภานุกร สิทธิโสด', nickname:'มาร์ท', role:'ช่างติดตั้ง', dept:'ปฏิบัติการ' },
  { code:'DN010', realName:'พัชรียา จ่าเขียว', nickname:'แพท', role:'แอดมิน', dept:'ธุรการ' },
  { code:'DN011', realName:'สมัชญา ใจ๋มา', nickname:'กี้', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN013', realName:'พุท บุญจี้', nickname:'ลา', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN014', realName:'ชลาลัย รินชัย', nickname:'เฟิร์น', role:'ผู้จัดการทรัพยากรบุคคล', dept:'ธุรการ' },
  { code:'DN015', realName:'ประวรรธนะ อินทร์ยิ้ม', nickname:'น็อต', role:'แอดมิน', dept:'ธุรการ' },
  { code:'DN016', realName:'ยุพา ศรีสว่าง', nickname:'นิล', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN017', realName:'ซาน ซาน ทวย', nickname:'ซาน', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN018', realName:'อิทธิพล เชอมือ', nickname:'บอย', role:'ช่างติดตั้ง', dept:'ปฏิบัติการ' },
  { code:'DN019', realName:'รัชนีวรรณ แซ่อึ้ง', nickname:'วุ้นเส้น', role:'พนักงานไลฟ์', dept:'ธุรการ' },
  { code:'DN020', realName:'มะลิวัลย์ เปี่ยมสกุลไพศาล', nickname:'เมย์', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN021', realName:'วิศวกร มาชม', nickname:'เกมส์', role:'จัดส่ง', dept:'ปฏิบัติการ' },
  { code:'DN022', realName:'นรมน แซตูกู', nickname:'ยู', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN023', realName:'Sangsar', nickname:'ศรี', role:'ช่างเย็บ', dept:'ปฏิบัติการ' },
  { code:'DN024', realName:'Jai Aung Jing', nickname:'อ๋อง', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN025', realName:'ฐิตาภา ทาวงค์', nickname:'แต้ว', role:'บัญชี', dept:'ธุรการ' },
  { code:'DN026', realName:'ศิริรัตน์ กันทาซาว', nickname:'เก๋', role:'บัญชี', dept:'ธุรการ' },
  { code:'DN027', realName:'บูตะ เชอมือ', nickname:'เจน', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN028', realName:'สุมาลี กุยวารีย์', nickname:'ไก่', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN029', realName:'สุลักษณา จันกิติ', nickname:'หนูนา', role:'แอดมิน', dept:'ธุรการ' },
  { code:'DN030', realName:'ธัญธิดา กีรัตยาธนฉัตร', nickname:'ออม', role:'ครีเอเตอร์', dept:'ธุรการ' },
  { code:'DN031', realName:'หม่อง คี ไป', nickname:'หาญ', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN032', realName:'หม่อง ยอง', nickname:'แลง', role:'ช่างทั่วไป', dept:'ปฏิบัติการ' },
  { code:'DN033', realName:'ธีรพล หม่องส่วย', nickname:'ที', role:'แพคสินค้า', dept:'ปฏิบัติการ' },
  { code:'DN034', realName:'ไซพ่อน หล่าย', nickname:'พงศ์', role:'แพคสินค้า', dept:'ปฏิบัติการ' },
]

// ลำดับสถานะงานผลิต (ใช้กันสแกนข้ามขั้น — เดินหน้าได้อย่างเดียว)
export const PROD_STATUS_FLOW = ['รอดำเนินการ', 'ตัดผ้าแล้ว', 'เย็บแล้ว', 'รีดแล้ว', 'แพ็คแล้ว', 'รอจัดส่ง', 'จัดส่งแล้ว'] as const

// แผนกผลิตที่สแกนได้ → สถานะที่จะตั้งเมื่อแผนกนั้นทำเสร็จ
export type Stage = { key: string; label: string; status: string }
export const STAGES: Stage[] = [
  { key: 'cut',  label: 'ตัด',  status: 'ตัดผ้าแล้ว' },
  { key: 'sew',  label: 'เย็บ', status: 'เย็บแล้ว' },
  { key: 'iron', label: 'รีด',  status: 'รีดแล้ว' },
  { key: 'pack', label: 'แพ็ค', status: 'แพ็คแล้ว' },
]

export const stageByKey = (key: string) => STAGES.find(s => s.key === key)

// index ในสายงาน (-1 ถ้าไม่รู้จัก/ไม่ใช่สถานะผลิต)
export const statusRank = (status: string | null | undefined) =>
  PROD_STATUS_FLOW.indexOf((status ?? '') as typeof PROD_STATUS_FLOW[number])

// เดินหน้าได้ไหม: สถานะปลายทางต้องอยู่ "หลัง" สถานะปัจจุบันในสายงาน
export const canAdvance = (current: string | null | undefined, target: string) => {
  const c = statusRank(current)
  const t = statusRank(target)
  if (t < 0) return false
  return t > (c < 0 ? -1 : c)
}
