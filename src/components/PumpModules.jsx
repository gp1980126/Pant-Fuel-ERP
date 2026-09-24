import React, { useEffect, useMemo, useRef, useState } from "react";

function inferLubricantPackSizeLitres(name){
  const v=String(name||"").toUpperCase().replace(/×/g,"X").trim();
  let m=v.match(/(\d+(?:\.\d+)?)\s*L(?:TR|ITRE)?\s*X\s*(\d+(?:\.\d+)?)\s*(?:BALTY|BALTI|BUCKETS?)/i);
  if(m) return Number(m[1]);
  m=v.match(/\d+(?:\.\d+)?\s*X\s*(\d+(?:\.\d+)?)\s*L(?:TR|ITRE)?/i);
  if(m) return Number(m[1]);
  return 0;
}

import { CLOUD_ENABLED, supabase, cloudSignIn, cloudSignOut, cloudGetProfile, cloudLoadState, cloudSaveState, subscribeState } from "../cloud_sync_supabase";
import {
  START_DATE,
  FINANCIAL_YEARS,
  DEFAULT_FINANCIAL_YEAR,
  financialYearBounds,
  PUMP_NAME,
  KEY,
  CLOUD_STATION_ID,
  HISTORICAL_DIP_MS_HSD_2026_08,
  USER_ROLES,
  DEFAULT_USERS,
  ROLE_PERMISSIONS,
  canAccess,
  OPENING,
  NOZZLES,
  METHODS,
  PARTY_NAMES,
  EMBEDDED_BACKUP_2026_09_06,
  DEFAULT_PAYTM_TOTALS,
  blankPay,
  blankPays,
  n,
  todayDate,
  rupee,
  money,
  moneyRupee,
  dk,
  ISO_DATE_RE,
  isValidISODate,
  todayISODate,
  assertPeriodDate,
  validateTransactionDate,
  stableHash,
  canonicalIntegrityValue,
  transactionFingerprint,
  makeLegacyTransactionId,
  ensureTransactionIdentity,
  identityArray,
  purchaseBusinessKey,
  findPurchaseDuplicate,
  verifyAuditChain,
  repairLegacyAuditChain,
  INTEGRITY_COLLECTION_TYPES,
  strictISODate,
  scanTransactionIntegrity,
  importComparableRow,
  importRowsEquivalent,
  rowImportDate,
  buildImportConflictReport,
  normalizeIntegrityData,
  findDuplicateTransaction,
  getRate,
  getPurchaseRate,
  purchaseLandedValue,
  purchaseEffectiveRate,
  fuelPurchaseSummary,
  latestRateHistory,
  normalizePOSPayments,
  syncCreditPayments,
  isPasswordHash,
  PURCHASE_TAX_POLICY,
  purchaseRef,
  linkFillingsToPurchases,
  dedupeExactCngSales,
  recoverKnownAug29Sales,
  cngDuplicateAuditRows,
  recoverKnownAug29PaymentRow,
  initialData,
  load,
  openingFor,
  payTotal,
  accountedTotal,
  canonicalDailyPayments,
  paymentForFuelStandard,
  actualPOSForDate,
  fuelPOSForDate,
  isFuelPOSBreakdownKnown,
  knownFuelPOSForDate,
  digitalPartyRecoveryForDate,
  posPartyMatchForDate,
  accountingSnapshot,
  salaryExpenseForPeriodPure,
  electricityExpenseForPeriodPure,
  cngSalePurchaseMatchingPure,
  authoritativeSalesRows,
  calculateProfitLossEngine,
  standardJournal,
  trialBalance,
  savedPayment,
  creditTotalForFuel,
  previousPending,
  monthKey,
  getLockedMonths,
  DATE_ARRAY_KEYS,
  changedMonthsForArray,
  findLockedMutation
} from "../core/pumpDomain";

/* =========================================================
   STAFF ATTENDANCE + ELECTRICITY BILL
========================================================= */
export 
function SecurityNotice() {
  return <div style={{marginBottom:14,padding:'10px 12px',borderRadius:10,border:'1px solid #fecaca',background:'#fff1f2',fontSize:12}}>
    <b>🔐 Security Notice:</b> Passwords are stored as SHA-256 hashes in this local build; plaintext default passwords are no longer embedded. This is still browser/localStorage authentication, so a server-backed production deployment should use server-side password hashing and sessions.
  </div>;
}

export function StaffElectricity({ data, update }) {
  const today = todayDate();
  const [month, setMonth] = useState(today.slice(0,7));
  const [staffForm, setStaffForm] = useState({ name:"", role:"Salesman", salary:"" });
  const [attendanceForm, setAttendanceForm] = useState({ staffId:"", date:today, status:"Present" });
  const [billForm, setBillForm] = useState({ month:month, billNo:"", amount:"", dueDate:"" });
  const [paymentForm, setPaymentForm] = useState({ month:month, date:today, amount:"", mode:"Bank", reference:"", note:"" });
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingBillId, setEditingBillId] = useState(null);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editingAttendanceId, setEditingAttendanceId] = useState(null);
  const [msg, setMsg] = useState("");

  const staff = Array.isArray(data.staff) ? data.staff : [];
  const attendance = Array.isArray(data.attendance) ? data.attendance : [];
  const bills = Array.isArray(data.electricityBills) ? data.electricityBills : [];
  const electricityPayments = Array.isArray(data.electricityPayments) ? data.electricityPayments : [];

  const monthAttendance = attendance.filter(a => String(a.date || "").slice(0,7) === month);
  const presentFor = id => monthAttendance.filter(a => String(a.staffId) === String(id) && a.status === "Present").length;
  const absentFor = id => monthAttendance.filter(a => String(a.staffId) === String(id) && a.status === "Absent").length;

  const addStaff = e => {
    e.preventDefault();
    const name = staffForm.name.trim();
    const salary = n(staffForm.salary);
    if (!name) return setMsg("Salesman का नाम भरें.");
    if (salary < 0) return setMsg("Salary गलत है.");
    if (editingStaffId !== null) {
      update({ staff:staff.map(x => String(x.id) === String(editingStaffId) ? { ...x, name, role:staffForm.role || "Salesman", salary } : x) });
      setMsg(`${name} की staff details update हो गई.`);
      setEditingStaffId(null);
    } else {
      const item = { id:Date.now(), name, role:staffForm.role || "Salesman", salary, active:true };
      update({ staff:[...staff,item] });
      setAttendanceForm(x => ({...x, staffId:String(item.id)}));
      setMsg(`${name} की salary ₹${salary.toLocaleString('en-IN')} save हो गई.`);
    }
    setStaffForm({ name:"", role:"Salesman", salary:"" });
  };

  const editStaff = item => {
    setEditingStaffId(item.id);
    setStaffForm({ name:item.name || "", role:item.role || "Salesman", salary:String(item.salary ?? "") });
    setMsg(`${item.name || "Staff"} edit mode में है.`);
  };

  const deleteStaff = id => {
    const item = staff.find(x => String(x.id) === String(id));
    if (!item) return;
    if (!window.confirm(`${item.name || "इस staff"} को delete करना है? इससे उसकी attendance भी हट जाएगी.`)) return;
    update({
      staff:staff.filter(x => String(x.id) !== String(id)),
      attendance:attendance.filter(a => String(a.staffId) !== String(id))
    });
    if (String(attendanceForm.staffId) === String(id)) setAttendanceForm(x => ({...x, staffId:""}));
    if (String(editingStaffId) === String(id)) { setEditingStaffId(null); setStaffForm({ name:"", role:"Salesman", salary:"" }); }
    setMsg("Staff और उसकी attendance delete कर दी गई.");
  };

  const saveAttendance = e => {
    e.preventDefault();
    if (!attendanceForm.staffId || !attendanceForm.date) return setMsg("Staff और date चुनें.");
    const id = editingAttendanceId !== null
      ? String(editingAttendanceId)
      : `${attendanceForm.staffId}|${attendanceForm.date}`;
    const next = [...attendance];
    const row = { id, staffId:String(attendanceForm.staffId), date:attendanceForm.date, status:attendanceForm.status };
    const idx = next.findIndex(x => String(x.id) === id);
    if (idx >= 0) next[idx] = row;
    else {
      const sameDay = next.findIndex(x => String(x.staffId) === String(row.staffId) && String(x.date) === String(row.date));
      if (sameDay >= 0) next[sameDay] = { ...next[sameDay], ...row, id:next[sameDay].id };
      else next.push(row);
    }
    update({ attendance:next });
    setMonth(attendanceForm.date.slice(0,7));
    setEditingAttendanceId(null);
    setMsg(`Attendance ${attendanceForm.status} के रूप में ${editingAttendanceId !== null ? "update" : "save"} हो गई.`);
  };

  const editAttendance = row => {
    setEditingAttendanceId(row.id);
    setAttendanceForm({ staffId:String(row.staffId || ""), date:row.date || today, status:row.status || "Present" });
    setMonth(String(row.date || today).slice(0,7));
    setMsg("Attendance edit mode में है.");
  };

  const deleteAttendance = id => {
    const row = attendance.find(x => String(x.id) === String(id));
    if (!row) return;
    const person = staff.find(x => String(x.id) === String(row.staffId));
    if (!window.confirm(`${person?.name || "इस staff"} की ${row.date} वाली attendance delete करनी है?`)) return;
    update({ attendance:attendance.filter(x => String(x.id) !== String(id)) });
    if (String(editingAttendanceId) === String(id)) setEditingAttendanceId(null);
    setMsg("Attendance entry delete कर दी गई.");
  };

  const uploadBill = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^application\/(pdf)$|^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setMsg("Electricity bill के लिए PDF, JPG, PNG या WEBP file चुनें."); e.target.value=""; return;
    }
    if (file.size > 4 * 1024 * 1024) { setMsg("Bill file 4 MB से छोटी रखें."); e.target.value=""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const common = { month:billForm.month || month, billNo:billForm.billNo.trim(), amount:n(billForm.amount), dueDate:billForm.dueDate || "", fileName:file.name, fileType:file.type, fileData:String(reader.result), uploadedAt:new Date().toISOString() };
      if (editingBillId !== null) {
        update({ electricityBills:bills.map(b => String(b.id) === String(editingBillId) ? { ...b, ...common } : b) });
        setMsg(`Electricity bill ${file.name} update हो गया.`); setEditingBillId(null);
      } else {
        update({ electricityBills:[{ id:Date.now(), ...common },...bills] });
        setMsg(`Electricity bill ${file.name} upload और save हो गया.`);
      }
      setBillForm(x => ({...x, billNo:"", amount:"", dueDate:""})); e.target.value="";
    };
    reader.onerror=()=>setMsg("Bill upload नहीं हो पाया."); reader.readAsDataURL(file);
  };

  const editBill = bill => {
    setEditingBillId(bill.id);
    setBillForm({ month:String(bill.month || month).slice(0,7), billNo:bill.billNo || "", amount:String(bill.amount ?? ""), dueDate:bill.dueDate || "" });
    setMsg("Electricity bill edit mode में है. नई file चुनकर Update करें.");
  };

  const deleteBill = id => {
    if (!window.confirm("क्या इस electricity bill को हटाना है?")) return;
    update({ electricityBills:bills.filter(b => String(b.id) !== String(id)) });
    if (String(editingBillId) === String(id)) setEditingBillId(null);
    setMsg("Electricity bill हटाया गया.");
  };

  const uploadPayment = e => {
    const file=e.target.files?.[0]; if (!file) return;
    if (!/^application\/(pdf)$|^image\/(jpeg|png|webp)$/i.test(file.type)) { setMsg("Payment receipt के लिए PDF, JPG, PNG या WEBP file चुनें."); e.target.value=""; return; }
    if (file.size > 4 * 1024 * 1024) { setMsg("Payment receipt 4 MB से छोटी रखें."); e.target.value=""; return; }
    const reader=new FileReader();
    reader.onload=()=>{
      const common={ month:paymentForm.month || month, date:paymentForm.date || today, amount:n(paymentForm.amount), mode:paymentForm.mode || "Bank", reference:paymentForm.reference.trim(), note:paymentForm.note.trim(), fileName:file.name, fileType:file.type, fileData:String(reader.result), uploadedAt:new Date().toISOString() };
      if (editingPaymentId !== null) { update({electricityPayments:electricityPayments.map(x=>String(x.id)===String(editingPaymentId)?{...x,...common}:x)}); setMsg(`Electricity payment ${file.name} update हो गया.`); setEditingPaymentId(null); }
      else { update({electricityPayments:[{id:Date.now(),...common},...electricityPayments]}); setMsg(`Electricity payment ${file.name} upload और save हो गया.`); }
      setPaymentForm({month:paymentForm.month || month,date:today,amount:"",mode:"Bank",reference:"",note:""}); e.target.value="";
    };
    reader.onerror=()=>setMsg("Payment receipt upload नहीं हो पाया."); reader.readAsDataURL(file);
  };

  const editPayment = payment => {
    setEditingPaymentId(payment.id);
    setPaymentForm({month:String(payment.month || month).slice(0,7),date:payment.date || today,amount:String(payment.amount ?? ""),mode:payment.mode || "Bank",reference:payment.reference || "",note:payment.note || ""});
    setMsg("Electricity payment edit mode में है. नई receipt चुनकर Update करें.");
  };

  const deletePayment = id => {
    if (!window.confirm("क्या इस electricity payment को हटाना है?")) return;
    update({electricityPayments:electricityPayments.filter(x=>String(x.id)!==String(id))});
    if (String(editingPaymentId)===String(id)) setEditingPaymentId(null);
    setMsg("Electricity payment हटाया गया.");
  };

  const selectedBillMonth = billForm.month || month;
  const monthBills = bills.filter(b => String(b.month || "").slice(0,7) === selectedBillMonth);
  const monthBillTotal = monthBills.reduce((sum,b)=>sum+n(b.amount),0);
  const monthPayments = electricityPayments.filter(x => String(x.month || "").slice(0,7) === selectedBillMonth);
  const monthPaidTotal = monthPayments.reduce((sum,x)=>sum+n(x.amount),0);
  const monthBalance = monthBillTotal - monthPaidTotal;

  return (
    <div className="content">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <div className="pro-eyebrow">STAFF · ATTENDANCE · ELECTRICITY</div>
          <h2>Staff & Electricity</h2>
          <p>Salesman की attendance और salary तथा electricity bills एक ही जगह पर सुरक्षित रखें.</p>
        </div>
      </section>

      {msg && <div className="collection-note green-note" style={{marginBottom:16}}>{msg}</div>}

      <div className="staff-grid">
        <section className="pro-panel">
          <div className="pro-panel-head"><div><h3>Salesman Attendance & Salary</h3><span>Selected month: {month}</span></div><input type="month" value={month} onChange={e=>setMonth(e.target.value)} /></div>

          <form onSubmit={addStaff} className="staff-form-grid">
            <label>Name<input value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})} placeholder="Salesman name" /></label>
            <label>Role<input value={staffForm.role} onChange={e=>setStaffForm({...staffForm,role:e.target.value})} placeholder="Salesman" /></label>
            <label>Monthly Salary<input type="number" min="0" step="1" value={staffForm.salary} onChange={e=>setStaffForm({...staffForm,salary:e.target.value})} placeholder="₹ Salary" /></label>
            <button className="btn" type="submit">{editingStaffId !== null ? "✓ Update Staff" : "+ Add Staff"}</button>{editingStaffId !== null && <button className="btn gray" type="button" onClick={()=>{setEditingStaffId(null);setStaffForm({name:"",role:"Salesman",salary:""});}}>Cancel</button>}
          </form>

          <div className="staff-table" style={{marginTop:16}}>
             {staff.length ? <table><thead><tr><th>Salesman</th><th>Role</th><th>Salary / Month</th><th>Present</th><th>Absent</th><th>Action</th></tr></thead><tbody>{staff.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td><span className="staff-pill">{s.role || "Salesman"}</span></td><td><b>{moneyRupee(s.salary)}</b></td><td>{presentFor(s.id)} days</td><td>{absentFor(s.id)} days</td><td><span className="bill-actions"><button className="btn small" type="button" onClick={()=>editStaff(s)}>✏️ Edit</button><button className="btn red small" type="button" onClick={()=>deleteStaff(s.id)}>🗑️ Delete</button></span></td></tr>)}</tbody></table> : <div className="empty-state">अभी salesman नहीं जोड़ा गया है.</div>}
           </div>

           <form onSubmit={saveAttendance} className="attendance-form">
            <label>Salesman<select value={attendanceForm.staffId} onChange={e=>setAttendanceForm({...attendanceForm,staffId:e.target.value})}><option value="">Select</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Date<input type="date" max={today} value={attendanceForm.date} onChange={e=>setAttendanceForm({...attendanceForm,date:e.target.value})} /></label>
            <label>Status<select value={attendanceForm.status} onChange={e=>setAttendanceForm({...attendanceForm,status:e.target.value})}><option>Present</option><option>Absent</option></select></label>
            <button className="btn" type="submit" disabled={!staff.length}>{editingAttendanceId !== null ? "✓ Update Attendance" : "Save Attendance"}</button>
            {editingAttendanceId !== null && <button className="btn gray" type="button" onClick={()=>{setEditingAttendanceId(null);setAttendanceForm(x=>({...x,status:"Present"}));}}>Cancel</button>}
          </form>

          <div className="attendance-summary"><div><span>Total Staff</span><b>{staff.length}</b></div><div><span>Present Entries</span><b>{monthAttendance.filter(a=>a.status === "Present").length}</b></div><div><span>Absent Entries</span><b>{monthAttendance.filter(a=>a.status === "Absent").length}</b></div></div>

          <div className="attendance-history" style={{marginTop:16}}>
            <div className="pro-panel-head" style={{marginBottom:8}}><div><h4 style={{margin:0}}>Attendance Data — {month}</h4><span>इस महीने की हर saved attendance entry यहाँ दिखाई देगी.</span></div></div>
            {monthAttendance.length ? (
              <div className="staff-table" style={{overflowX:"auto"}}>
                <table>
                  <thead><tr><th>Date</th><th>Salesman</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {monthAttendance.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(a => {
                      const person = staff.find(s => String(s.id) === String(a.staffId));
                      return <tr key={a.id}>
                        <td><b>{a.date}</b></td>
                        <td>{person?.name || "Unknown Staff"}</td>
                        <td><span className="staff-pill" style={a.status === "Absent" ? {background:"#fff1f2",color:"#be123c"} : {}}>{a.status}</span></td>
                        <td><span className="bill-actions"><button className="btn small" type="button" onClick={()=>editAttendance(a)}>✏️ Edit</button><button className="btn red small" type="button" onClick={()=>deleteAttendance(a.id)}>🗑️ Delete</button></span></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state">{month} में अभी कोई attendance entry save नहीं हुई है.</div>}
          </div>

          <div className="staff-note">यह module salary और attendance record दिखाता है. Attendance के आधार पर salary काटने/प्रोराटा करने की calculation अपने-आप नहीं की गई है, ताकि आपकी existing accounting प्रभावित न हो.</div>
        </section>

        <section className="pro-panel">
          <div className="pro-panel-head"><div><h3>Electricity Bill</h3><span>PDF / JPG / PNG / WEBP upload करके record रखें.</span></div></div>
          <div className="bill-form-grid">
            <label>Bill Month<input type="month" value={billForm.month} onChange={e=>{setBillForm({...billForm,month:e.target.value});setMonth(e.target.value)}} /></label>
            <label>Bill No.<input value={billForm.billNo} onChange={e=>setBillForm({...billForm,billNo:e.target.value})} placeholder="Optional" /></label>
            <label>Bill Amount<input type="number" min="0" step="0.01" value={billForm.amount} onChange={e=>setBillForm({...billForm,amount:e.target.value})} placeholder="₹ Amount" /></label>
            <label>Due Date<input type="date" value={billForm.dueDate} onChange={e=>setBillForm({...billForm,dueDate:e.target.value})} /></label>
            <div className="bill-upload"><b>📎 {editingBillId !== null ? "Update Electricity Bill File" : "Upload Electricity Bill"}</b><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadBill} /></div>
          </div>

          <div className="collection-total" style={{marginTop:14}}><span>{selectedBillMonth} Bills</span><strong>{money(monthBillTotal)}</strong><small>{monthBills.length} uploaded bill(s)</small></div>

          <div className="bill-list">
             {monthBills.length ? monthBills.map(b=><div className="bill-row" key={b.id}><div><b>{b.fileName || "Electricity Bill"}</b><small>{b.billNo ? `Bill No. ${b.billNo} · ` : ""}{b.dueDate ? `Due ${b.dueDate} · ` : ""}{b.fileType || "file"}</small></div><div className="bill-actions"><strong>{moneyRupee(b.amount)}</strong>{b.fileData && <a href={b.fileData} target="_blank" rel="noreferrer">View</a>}<button className="btn small" type="button" onClick={()=>editBill(b)}>✏️ Edit</button><button className="btn red small" type="button" onClick={()=>deleteBill(b.id)}>🗑️ Delete</button></div></div>) : <div className="empty-state">इस महीने का electricity bill अभी upload नहीं हुआ है.</div>}
           </div>

           <div className="collection-total" style={{marginTop:16}}><span>{selectedBillMonth} Payment</span><strong>{money(monthPaidTotal)}</strong><small>{monthPayments.length} payment receipt(s) · Balance {money(monthBalance)}</small></div>
           <div className="bill-form-grid" style={{marginTop:12}}>
             <label>Payment Month<input type="month" value={paymentForm.month} onChange={e=>setPaymentForm({...paymentForm,month:e.target.value})} /></label>
             <label>Payment Date<input type="date" max={today} value={paymentForm.date} onChange={e=>setPaymentForm({...paymentForm,date:e.target.value})} /></label>
             <label>Payment Amount<input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={e=>setPaymentForm({...paymentForm,amount:e.target.value})} placeholder="₹ Amount" /></label>
             <label>Payment Mode<select value={paymentForm.mode} onChange={e=>setPaymentForm({...paymentForm,mode:e.target.value})}><option>Bank</option><option>UPI</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
             <label>UTR / Reference<input value={paymentForm.reference} onChange={e=>setPaymentForm({...paymentForm,reference:e.target.value})} placeholder="Optional" /></label>
             <label>Note<input value={paymentForm.note} onChange={e=>setPaymentForm({...paymentForm,note:e.target.value})} placeholder="Optional" /></label>
             <div className="bill-upload"><b>📎 {editingPaymentId !== null ? "Update Electricity Payment Receipt" : "Upload Electricity Payment Receipt"}</b><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadPayment} /></div>
           </div>
           <div className="bill-list">
             {monthPayments.length ? monthPayments.map(x=><div className="bill-row" key={x.id}><div><b>{x.fileName || "Payment Receipt"}</b><small>{x.date || ""} · {x.mode || ""}{x.reference ? ` · Ref ${x.reference}` : ""}{x.note ? ` · ${x.note}` : ""}</small></div><div className="bill-actions"><strong>{moneyRupee(x.amount)}</strong>{x.fileData && <a href={x.fileData} target="_blank" rel="noreferrer">View</a>}<button className="btn small" type="button" onClick={()=>editPayment(x)}>✏️ Edit</button><button className="btn red small" type="button" onClick={()=>deletePayment(x.id)}>🗑️ Delete</button></div></div>) : <div className="empty-state">इस महीने का electricity payment receipt अभी upload नहीं हुआ है.</div>}
           </div>
           <div className="staff-note">Bill और payment receipt local browser data तथा Backup JSON में save होंगे. Bill और payment दोनों की monthly history अलग-अलग रखी जाएगी.</div>
        </section>
      </div>
    </div>
  );
}

/* =========================================================
   USER MANAGEMENT
========================================================= */
export function UserManagement({ data, update }) {
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(null);
  const users = Array.isArray(data.users) ? data.users : DEFAULT_USERS;

  const saveUser = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const id = editing?.id || Date.now();
    const user = {
      id,
      username: String(f.get("username") || "").trim(),
      password: String(f.get("password") || ""),
      role: String(f.get("role") || USER_ROLES.OPERATOR),
      name: String(f.get("name") || "").trim(),
      active: f.get("active") === "on"
    };
    if (!user.username || !user.name || (!editing && !user.password)) {
      setMsg("Name, Username और Password भरें।"); return;
    }
    if (editing && !user.password) user.password = editing.password;
    if (!isPasswordHash(user.password)) user.password = await hashPassword(user.password);
    const exists = users.some(u => u.username === user.username && u.id !== id);
    if (exists) { setMsg("यह username पहले से मौजूद है।"); return; }
    update({users: editing ? users.map(u => u.id === id ? user : u) : [...users, user]});
    setEditing(null); e.currentTarget.reset(); setMsg("User save हो गया।");
  };

  const remove = id => {
    if (users.length <= 1) return;
    if (!window.confirm("User delete करें?")) return;
    update({users: users.filter(u => u.id !== id)});
  };

  return <div className="content">
    <div className="panel">
      <h2>User Management</h2>
      <p>Admin/Owner यहाँ 4-role users manage कर सकते हैं।</p>
      <form className="form" onSubmit={saveUser}>
        <div className="field"><span>Name</span><input name="name" defaultValue={editing?.name || ""}/></div>
        <div className="field"><span>Username</span><input name="username" defaultValue={editing?.username || ""}/></div>
        <div className="field"><span>Password</span><input name="password" type="password" defaultValue="" placeholder={editing ? "Blank = keep current password" : "Set password"}/></div>
        <div className="field"><span>Role</span><select name="role" defaultValue={editing?.role || USER_ROLES.OPERATOR}>
          <option>Admin</option><option>Owner</option><option>Manager</option><option>Operator</option><option>View Only</option>
        </select></div>
        <div className="field"><span>Active</span><input name="active" type="checkbox" defaultChecked={editing ? editing.active : true}/></div>
        <div className="actions"><button className="btn" type="submit">{editing ? "Update User" : "Add User"}</button>
        {editing && <button className="btn gray" type="button" onClick={()=>setEditing(null)}>Cancel</button>}</div>
      </form>
      {msg && <div className="notice">{msg}</div>}
    </div>
    <br/>
    <div className="panel"><div className="table"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.username}</td><td>{u.role}</td><td>{u.active===false?"Inactive":"Active"}</td>
      <td><button className="btn small" onClick={()=>setEditing(u)}>Edit</button> <button className="btn small red" onClick={()=>remove(u.id)}>Delete</button></td></tr>)}</tbody>
    </table></div></div>
  </div>;
}


/* =========================================================
   AUDIT TRAIL
========================================================= */
export function AuditTrail({ data }) {
  const rows = (Array.isArray(data?.auditLogs) ? data.auditLogs : []).slice().reverse();
  return <div className="content"><section className="panel"><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><h2>🧾 Audit Trail</h2><p style={{margin:0}}>हर saved data update का user, role, time और changed sections रिकॉर्ड होते हैं। Last 2,000 events रखे जाते हैं।</p></div><div className="mini"><span>TOTAL EVENTS</span><strong>{rows.length}</strong></div></div><div className="table" style={{marginTop:16,overflowX:'auto'}}><table><thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead><tbody>{rows.length?rows.map(r=><tr key={r.id}><td>{new Date(r.at).toLocaleString('en-IN')}</td><td>{r.username}</td><td>{r.role}</td><td>{r.action}</td><td>{r.details}</td></tr>):<tr><td colSpan="5">No audit events yet.</td></tr>}</tbody></table></div></section></div>;
}

/* =========================================================
   ACCOUNTING PERIOD LOCK
========================================================= */
export function AccountingPeriodLock({ data, update, session }) {
  const today = todayDate();
  const [month, setMonth] = useState(today.slice(0,7));
  const locked = Array.from(getLockedMonths(data)).sort().reverse();
  const isLocked = locked.includes(month);

  const monthsInData = [...new Set([
    ...(data.sales || []).map(x => monthKey(x.date)),
    ...(data.purchases || []).map(x => monthKey(x.date)),
    ...(data.credits || []).map(x => monthKey(x.date)),
    ...(data.fillings || []).map(x => monthKey(x.date)),
    ...(data.dailyPayments || []).map(x => monthKey(x.date)),
    ...(data.ledgerPayments || []).map(x => monthKey(x.date)),
    ...(data.recoveries || []).map(x => monthKey(x.date)),
    ...(data.rateHistory || []).map(x => monthKey(x.date)),
    ...(data.dipReadings || []).map(x => monthKey(x.date)),
    ...(data.paytmTotals || []).map(x => monthKey(x.date)),
    today.slice(0,7)
  ].filter(Boolean))].sort().reverse();

  if (![USER_ROLES.ADMIN, USER_ROLES.OWNER].includes(session?.role)) {
    return <div className="content"><section className="panel"><h2>🔒 Access Denied</h2><p>Accounting Period Lock केवल Admin / Owner के लिए है।</p></section></div>;
  }

  const lockMonth = () => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    if (isLocked) return;
    if (!window.confirm(`${month} को FINAL करके LOCK करना है? Lock के बाद इस महीने की Sale, Purchase, Credit, Payment, Filling, DIP, Rate और Recovery में edit/add/delete नहीं होगा।`)) return;
    update({ accountingLocks: { months: [...new Set([...locked, month])] } });
  };

  const unlockMonth = () => {
    if (!isLocked) return;
    if (session?.role !== USER_ROLES.ADMIN && session?.role !== USER_ROLES.OWNER) return;
    if (!window.confirm(`${month} का accounting lock हटाना है? Unlock के बाद पुरानी entries फिर बदली जा सकती हैं। यह action Audit Trail में record होगा।`)) return;
    update({ accountingLocks: { months: locked.filter(x => x !== month) } });
  };

  return <div className="content">
    <section className="panel">
      <h2>🔒 Accounting Period Lock</h2>
      <p>Closed month की historical accounting data को freeze करें। Lock केवल Admin / Owner कर सकते हैं।</p>
      <div className="form">
        <Field label="Accounting Month">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </Field>
        <div className="card" style={{marginTop:0}}>
          <span>Status</span>
          <strong>{isLocked ? "🔒 LOCKED" : "🟢 OPEN"}</strong>
          <small>{isLocked ? "Historical transactions protected हैं." : "Month अभी editable है."}</small>
        </div>
      </div>
      <div className="actions" style={{marginTop:12}}>
        {!isLocked ? <button type="button" className="btn" onClick={lockMonth}>🔒 FINAL & LOCK {month}</button> : <button type="button" className="btn red" onClick={unlockMonth}>🔓 UNLOCK {month}</button>}
      </div>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <h3>Locked Months</h3>
      <div className="table"><table><thead><tr><th>Month</th><th>Status</th></tr></thead><tbody>{locked.length ? locked.map(m => <tr key={m}><td><b>{m}</b></td><td>🔒 LOCKED</td></tr>) : <tr><td colSpan="2">अभी कोई month locked नहीं है।</td></tr>}</tbody></table></div>
      <p style={{marginTop:12,fontSize:12,color:'#64748b'}}>Available data months: {monthsInData.join(', ') || '—'}</p>
    </section>
  </div>;
}

/* =========================================================
   DASHBOARD
========================================================= */

export function CollectionDetail({ data, totals, setPage, update }) {
  const today = todayDate();
  const allDates = [...new Set([
    ...(data.sales || []).map(x => x.date),
    ...(data.paytmTotals || []).map(x => x.date),
    ...(data.dailyPayments || []).map(x => x.date),
    ...(data.ledgerPayments || []).map(x => x.date),
    ...(data.credits || []).map(x => x.date),
    ...(data.recoveries || []).map(x => x.date)
  ].filter(d => d && String(d) <= today))].sort();

  const [date, setDate] = useState(allDates[allDates.length - 1] || todayDate());
  const [month, setMonth] = useState((allDates[allDates.length - 1] || todayDate()).slice(0,7));

  useEffect(() => {
    if (date) setMonth(String(date).slice(0,7));
  }, [date]);

  // Prefer the most complete saved payment row for a date.
  // Legacy backups can contain duplicate/partial rows; canonicalDailyPayments()
  // may otherwise select the incomplete row and make Collection look blank.
  const dayRow = d => {
    const rowsForDate = (Array.isArray(data.dailyPayments) ? data.dailyPayments : [])
      .filter(r => String(r?.date || "") === String(d));

    const scorePaymentRow = row => {
      const fuels = ["MS", "HSD", "CNG"];
      const keys = [
        "cash", "paytm", "card", "dtplus", "hppay", "phonepe",
        "credit", "pumpExpense", "other"
      ];
      return fuels.reduce((score, fuel) => {
        const p = row?.[fuel];
        if (!p || typeof p !== "object") return score;
        return score + keys.reduce(
          (nKeys, key) => nKeys + (p[key] !== undefined && p[key] !== "" ? 1 : 0),
          0
        );
      }, 0);
    };

    return rowsForDate.reduce(
      (best, row) => !best || scorePaymentRow(row) > scorePaymentRow(best) ? row : best,
      null
    ) || canonicalDailyPayments(data).find(r => String(r.date) === String(d)) || {};
  };
  const creditsForDate = d => (data.credits || []).filter(c => String(c.date) === String(d));
  const creditByFuel = d => {
    const out = { MS:0, HSD:0, CNG:0 };
    creditsForDate(d).forEach(c => { if (out[c.fuel] !== undefined) out[c.fuel] += n(c.amount); });
    return out;
  };
  const salesForDate = d => (data.sales || []).filter(s => String(s.date) === String(d));
  const saleTotal = d => salesForDate(d).reduce((a,s) => a + n(s.amount), 0);
  const modes = d => {
    const x = dayRow(d);
    const credit = creditByFuel(d);
    return {
      cash: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.cash),0),
      paytm: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.paytm),0),
      card: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.card),0),
      dtplus: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.dtplus),0),
      hppay: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.hppay),0),
      phonepe: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.phonepe),0),
      other: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.other),0),
      credit: credit.MS + credit.HSD + credit.CNG,
      msCredit: credit.MS, hsdCredit: credit.HSD, cngCredit: credit.CNG,
      pumpExpense: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.pumpExpense),0),
      difference: ['MS','HSD','CNG'].reduce((a,f)=>a+n(x[f]?.difference),0)
    };
  };

  const savedPOSTotal = n((data.paytmTotals || []).find(x => String(x.date) === String(date))?.amount);
  const [posAmount, setPosAmount] = useState(String(savedPOSTotal || ""));
  useEffect(() => setPosAmount(savedPOSTotal ? String(savedPOSTotal) : ""), [date, savedPOSTotal]);

  const saveActualPOS = () => {
    const amount = rupee(posAmount);
    const list = Array.isArray(data.paytmTotals) ? [...data.paytmTotals] : [];
    const idx = list.findIndex(x => String(x.date) === String(date));
    const row = { date, amount };
    if (idx >= 0) list[idx] = { ...list[idx], ...row };
    else list.push(row);
    update({ paytmTotals: list });
    setPosAmount(String(amount));
  };

  const m = modes(date);
  const actualPOS = n(posAmount);
  const fuelPOS = m.paytm + m.card;
  const posShort = Math.max(0, fuelPOS - actualPOS);
  const partyPayments = (data.ledgerPayments || []).filter(x => String(x.date) === String(date));
  const partyRecovery = partyPayments.reduce((sum,x)=>sum+n(x.amount),0);
  const settledPOSEntry = posPartyMatchForDate(data, date);
  const rawPOSExcess = Math.max(0, actualPOS - fuelPOS);
  // POS Excess becomes visible only after the corresponding Party Ledger
  // settlement is accounted for; only the remaining unmatched amount is shown.
  const remainingPosExcess = Math.max(0, rawPOSExcess - settledPOSEntry);

  const monthDates = allDates.filter(d => String(d).slice(0,7) === month);
  const months = [...new Set(allDates.map(d => String(d).slice(0,7)))].sort().reverse();

  function exportCollectionExcel() {
    const esc = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
    const rows = [["SATAT FILLING STATION"],["POS / Collection Detail - Day Wise"],
      ["Date","Sales","Cash","Paytm + POS","ATM/Card","DT Plus","HP Pay","PhonePe","Other Digital","Credit MS","Credit HSD","Credit CNG","Total Credit","POS Actual","POS Excess","POS Short","Party Recovery","Pump Expense"]];
    allDates.forEach(d => { const q=modes(d), pos=n((data.paytmTotals||[]).find(x=>String(x.date)===String(d))?.amount); rows.push([d,saleTotal(d),q.cash,q.paytm,q.card,q.dtplus,q.hppay,q.phonepe,q.other,q.msCredit,q.hsdCredit,q.cngCredit,q.credit,pos,Math.max(0,pos-q.paytm-q.card-posPartyMatchForDate(data,d)),Math.max(0,q.paytm+q.card-pos),(data.ledgerPayments||[]).filter(x=>String(x.date)===String(d)).reduce((a,x)=>a+n(x.amount),0),q.pumpExpense]); });
    const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(esc).join(',')).join('\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`POS_Collection_Day_Wise_${month}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function printCollectionPdf() {
    const body = allDates.map(d => { const q=modes(d), pos=n((data.paytmTotals||[]).find(x=>String(x.date)===String(d))?.amount); return `<tr><td>${d}</td><td>${money(saleTotal(d))}</td><td>${money(q.cash)}</td><td>${money(q.paytm)}</td><td>${money(q.card)}</td><td>${money(q.dtplus)}</td><td>${money(q.hppay)}</td><td>${money(q.phonepe)}</td><td>${money(q.other)}</td><td>${money(q.credit)}</td><td>${money(pos)}</td><td>${money(Math.max(0,pos-q.paytm-q.card-posPartyMatchForDate(data,d)))}</td><td>${money(Math.max(0,q.paytm+q.card-pos))}</td></tr>`; }).join('');
    const totalsRow = `<tr><th>TOTAL</th><th>${money(allDates.reduce((a,d)=>a+saleTotal(d),0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).cash,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).paytm,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).card,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).dtplus,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).hppay,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).phonepe,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).other,0))}</th><th>${money(allDates.reduce((a,d)=>a+modes(d).credit,0))}</th><th>${money(allDates.reduce((a,d)=>a+n((data.paytmTotals||[]).find(x=>String(x.date)===String(d))?.amount),0))}</th><th colspan="2"></th></tr>`;
    const w=window.open('','_blank'); if(!w){alert('Print window blocked है. Browser में pop-up allow करें.');return;}
    w.document.write(`<!doctype html><html><head><title>POS Collection Day Wise</title><style>body{font-family:Arial;margin:16px}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #555;padding:4px;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#eee}</style></head><body><h1>SATAT FILLING STATION</h1><h2>POS / Collection Detail — Month & Day Wise</h2><table><thead><tr><th>Date</th><th>Sales</th><th>Cash</th><th>Paytm+POS</th><th>ATM/Card</th><th>DT Plus</th><th>HP Pay</th><th>PhonePe</th><th>Other Digital</th><th>Credit</th><th>POS Actual</th><th>POS Excess</th><th>POS Short</th></tr></thead><tbody>${body}${totalsRow}</tbody></table></body></html>`); w.document.close();
  }

  function shareCollectionWhatsApp() {
    const totalCredit=allDates.reduce((a,d)=>a+modes(d).credit,0);
    const text=`*SATAT FILLING STATION*\n*POS / Collection Detail*\nMonth: ${month}\nDays: ${monthDates.length}\nCredit Sale: ${money(totalCredit)}\nSelected Date: ${date}\nSelected Day Credit: ${money(m.credit)}\nMS Credit: ${money(m.msCredit)}\nHSD Credit: ${money(m.hsdCredit)}\nCNG Credit: ${money(m.cngCredit)}\nPOS Actual: ${money(actualPOS)}\nPOS Excess: ${money(remainingPosExcess)}\nPOS Short: ${money(posShort)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank');
  }

  return (
    <div className="content collection-page">
      <div className="collection-hero">
        <div><div className="pro-eyebrow">COLLECTION CONTROL</div><h2>POS / Collection Detail</h2><p>हर महीने की हर तारीख का Cash, Paytm/POS, ATM/Card, DT Plus, HP Pay, PhonePe, Other Digital, Credit और Short/Excess अलग-अलग.</p></div>
        <div className="collection-actions"><button className="btn gray" type="button" onClick={()=>setPage('Dashboard')}>← Dashboard</button><label className="collection-date">Date <input type="date" min={START_DATE} max={today} value={date} onChange={e=>setDate(e.target.value)} /></label></div>
      </div>

      <div className="collection-actions" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
        <button className="btn" type="button" onClick={printCollectionPdf}>🖨️ Print PDF</button>
        <button className="btn" type="button" onClick={exportCollectionExcel}>📊 Excel</button>
        <button className="btn" type="button" onClick={shareCollectionWhatsApp}>🟢 WhatsApp</button>
      </div>

      <div className="collection-kpis">
        <div className="collection-kpi blue"><span>POS में वास्तव में आया — Paytm + ATM</span><strong>{money(actualPOS)}</strong><small>Selected date का saved POS total</small><div style={{display:'flex',gap:8,marginTop:10}}><input type="number" step=".01" value={posAmount} onChange={e=>setPosAmount(e.target.value)} placeholder="Actual POS total" style={{flex:1,minWidth:0,padding:'8px 9px',border:'1px solid #cbd5e1',borderRadius:7}}/><button className="btn small" type="button" onClick={saveActualPOS}>Save POS</button></div></div>
        <div className="collection-kpi green"><span>Fuel POS — Paytm + ATM/Card</span><strong>{money(fuelPOS)}</strong><small>Fuel payment modes</small></div>
        <div className="collection-kpi orange"><span>POS Excess</span><strong>{money(remainingPosExcess)}</strong><small>Actual POS − Fuel POS</small></div>
        <div className="collection-kpi red"><span>POS Short</span><strong>{money(posShort)}</strong><small>Fuel POS − Actual POS</small></div>
        <div className="collection-kpi purple"><span>Total Credit Sale</span><strong>{money(m.credit)}</strong><small>MS {money(m.msCredit)} · HSD {money(m.hsdCredit)} · CNG {money(m.cngCredit)}</small></div>
      </div>

      <div className="collection-grid">
        <section className="pro-panel"><div className="pro-panel-head"><div><h3>Full Digital Detail — {date}</h3><span>Other Digital अब एक ही total नहीं; हर mode अलग दिखेगा.</span></div></div><div className="collection-breakdown">
          <div><span>Cash</span><b>{money(m.cash)}</b></div><div><span>Paytm + POS</span><b>{money(m.paytm)}</b></div><div><span>ATM / Card</span><b>{money(m.card)}</b></div><div><span>DT Plus</span><b>{money(m.dtplus)}</b></div><div><span>HP Pay</span><b>{money(m.hppay)}</b></div><div><span>PhonePe</span><b>{money(m.phonepe)}</b></div><div><span>Other Digital</span><b>{money(m.other)}</b></div><div><span>Credit — MS</span><b>{money(m.msCredit)}</b></div><div><span>Credit — HSD</span><b>{money(m.hsdCredit)}</b></div><div><span>Credit — CNG</span><b>{money(m.cngCredit)}</b></div><div><span>Party Recovery</span><b>{money(partyRecovery)}</b></div><div><span>Pump Expense</span><b>{money(m.pumpExpense)}</b></div>
          <div className="total"><span>Total Credit</span><b>{money(m.credit)}</b></div>
        </div></section>
        <section className="pro-panel"><div className="pro-panel-head"><div><h3>Credit Sale Details — {date}</h3><span>Credit Sale register से exact parchi-wise amount.</span></div><button className="pro-link" type="button" onClick={()=>setPage('Credit Sale')}>Open Credit Sale →</button></div>{creditsForDate(date).length ? <div className="collection-party-list">{creditsForDate(date).map(c=><div key={c.id}><div><b>{c.party}</b><small>Parchi {c.parchiNo} · {c.fuel} · Qty {n(c.qty)}</small></div><strong>{moneyRupee(c.amount)}</strong></div>)}<div className="collection-party-total"><span>Total Credit</span><b>{money(m.credit)}</b></div></div> : <div className="empty-state">इस तारीख को Credit Sale नहीं मिली.</div>}</section>
      </div>

      <section className="pro-panel" style={{marginTop:18}}><div className="pro-panel-head"><div><h3>Month-wise / Day-wise Collection History</h3><span>किसी भी महीने को चुनें; उस महीने की सभी dates नीचे रहेंगी.</span></div><select value={month} onChange={e=>setMonth(e.target.value)}>{months.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
        <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Date</th><th>Sales</th><th>Cash</th><th>Paytm+POS</th><th>ATM/Card</th><th>DT Plus</th><th>HP Pay</th><th>PhonePe</th><th>Other Digital</th><th>Credit</th><th>POS Actual</th><th>Excess</th><th>Short</th></tr></thead><tbody>{monthDates.map(d=>{const q=modes(d), pos=n((data.paytmTotals||[]).find(x=>String(x.date)===String(d))?.amount);return <tr key={d} onClick={()=>setDate(d)} style={{cursor:'pointer',background:d===date?'#eef6ff':''}}><td>{d}</td><td>{money(saleTotal(d))}</td><td>{money(q.cash)}</td><td>{money(q.paytm)}</td><td>{money(q.card)}</td><td>{money(q.dtplus)}</td><td>{money(q.hppay)}</td><td>{money(q.phonepe)}</td><td>{money(q.other)}</td><td><b>{money(q.credit)}</b></td><td>{money(pos)}</td><td>{money(Math.max(0,pos-q.paytm-q.card-posPartyMatchForDate(data,d)))}</td><td>{money(Math.max(0,q.paytm+q.card-pos))}</td></tr>})}</tbody><tfoot><tr><th>TOTAL</th><th>{money(monthDates.reduce((a,d)=>a+saleTotal(d),0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).cash,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).paytm,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).card,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).dtplus,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).hppay,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).phonepe,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).other,0))}</th><th>{money(monthDates.reduce((a,d)=>a+modes(d).credit,0))}</th><th>{money(monthDates.reduce((a,d)=>a+n((data.paytmTotals||[]).find(x=>String(x.date)===String(d))?.amount),0))}</th><th colSpan="2"></th></tr></tfoot></table></div>
      </section>

      <section className="pro-panel" style={{marginTop:18}}><div className="pro-panel-head"><div><h3>Party Payment Receiving</h3><span>Selected date</span></div><button className="pro-link" type="button" onClick={()=>setPage('Party Ledger')}>Open Party Ledger →</button></div>{partyPayments.length?<div className="collection-party-list">{partyPayments.map(p=><div key={p.id}><div><b>{p.party}</b><small>{p.mode||'—'}{p.note?` · ${p.note}`:''}</small></div><strong>{moneyRupee(p.amount)}</strong></div>)}<div className="collection-party-total"><span>Total Recovery</span><b>{money(partyRecovery)}</b></div></div>:<div className="empty-state">इस तारीख को Party Payment Receiving नहीं मिली.</div>}</section>
    </div>
  );
}

export function Dashboard({ data, totals, setPage }) {
  const [posDetailOpen, setPosDetailOpen] = useState(false);
  const today = todayDate();
  const latestDate=[...new Set([...(data.sales||[]).map(x=>x.date),...(data.dailyPayments||[]).map(x=>x.date),...(data.credits||[]).map(x=>x.date)])]
    .filter(d => d && String(d) <= today)
    .sort().reverse()[0] || today;
  const tb=trialBalance(data,START_DATE,latestDate);
  const totalDebit=tb.reduce((s,x)=>s+x.debit,0), totalCredit=tb.reduce((s,x)=>s+x.credit,0);
  const rows=[['MS','MS (Petrol)',totals.saleByFuel.MS,totals.qty.MS],['HSD','HSD (Diesel)',totals.saleByFuel.HSD,totals.qty.HSD],['CNG','CNG',totals.saleByFuel.CNG,totals.qty.CNG]];
  const quick=[['⛽','Fuel Sale','Fuel Sale'],['₹','Collection','Collection Detail'],['👥','Party Ledger','Party Ledger'],['🧾','Purchase','Purchase'],['📚','Accounts','Accounts'],['📊','Reports','Reports']];
  const posDetailRows = [...new Set([
    ...(data.dailyPayments || []).map(x => x.date),
    ...(data.ledgerPayments || []).map(x => x.date)
  ])].filter(Boolean).sort().reverse().map(date => {
    const actual = actualPOSForDate(data, date);
    const fuel = fuelPOSForDate(data, date);
    const excess = Math.max(0, actual - fuel);
    const matched = posPartyMatchForDate(data, date);
    const unmatched = Math.max(0, excess - matched);
    return { date, actual, fuel, excess, matched, unmatched };
  }).filter(x => x.unmatched > 0);
  const posDetailTotal = posDetailRows.reduce((s,x) => s + x.unmatched, 0);
  return <div className="content pro-dashboard premium-dashboard">
    <div className="dashboard-hero"><div className="hero-copy"><div className="pro-eyebrow">PUMPPRO · STANDARD ACCOUNTING</div><h2>Accounts Dashboard</h2><p>{PUMP_NAME} · Source data loaded through <b>{latestDate}</b> · Double-entry view</p></div><div className="hero-actions"><button className="hero-date">📅 {latestDate}</button><button className="pro-primary" onClick={()=>setPage('Accounts')}>📚 Accounts</button></div></div>
    <div className="pro-kpis premium-kpis">
      <div className="pro-kpi blue"><div className="pro-kpi-icon">↗</div><div><span>Sales</span><strong>{money(totals.sale)}</strong><small>Fuel sales register</small></div></div>
      <div className="pro-kpi green"><div className="pro-kpi-icon">₹</div><div><span>Receipts</span><strong>{money(totals.collection)}</strong><small>Fuel + party + recovery</small></div></div>
      <div className="pro-kpi orange"><div className="pro-kpi-icon">👥</div><div><span>Trade Receivables</span><strong>{money(totals.receivable)}</strong><small>Opening + credit sales − receipts</small></div></div>
      <div className="pro-kpi red"><div className="pro-kpi-icon">▣</div><div><span>Operating Expense</span><strong>{money(totals.pumpExpense)}</strong><small>Recorded expense entries</small></div></div>
    </div>
    <div className="premium-grid-top">
      <section className="pro-panel"><div className="pro-panel-head"><div><h3>Fuel Sales</h3><span>Meter-based revenue</span></div><button className="pro-link" onClick={()=>setPage('Daily Sale Summary')}>View →</button></div><div className="table pro-table premium-table"><table><thead><tr><th>Fuel</th><th>Qty</th><th>Sales</th></tr></thead><tbody>{rows.map(([f,label,s,q])=><tr key={f}><td><b>{label}</b></td><td>{f==='CNG'?q.toFixed(3)+' Kg':q.toFixed(2)+' L'}</td><td><b>{money(s)}</b></td></tr>)}<tr className="total-row"><td>TOTAL</td><td>—</td><td>{money(totals.sale)}</td></tr></tbody></table></div></section>
      <section className="pro-panel"><div className="pro-panel-head"><div><h3>Payment Receipts</h3><span>Actual recorded receipt modes</span></div><button className="pro-link" onClick={()=>setPage('Collection Detail')}>Detail →</button></div><div className="pro-summary-list">{[['Cash',totals.cash],['Paytm + ATM (POS)',totals.paytm],['DT Plus',totals.dtplus],['HP Pay',totals.hppay],['PhonePe',totals.phonepe],['Party Receipts',totals.partyRecovery],['Receivable Recovery',totals.salesmanRecovery]].map(([k,v])=><div key={k}><span>{k}</span><b>{money(v)}</b></div>)}<div><span><b>Total Receipts</b></span><b>{money(totals.collection)}</b></div></div></section>
      <section className="pro-panel"><div className="pro-panel-head"><div><h3>Ledger Control</h3><span>Accounting checks</span></div></div><div className="attention-card ok"><span>Trial Balance</span><b>{money(totalDebit)} = {money(totalCredit)}</b><small>{Math.abs(totalDebit-totalCredit)<1?'Balanced':'Check entries'}</small></div><button type="button" className="attention-card" onClick={()=>setPage('Purchase')} style={{width:'100%',textAlign:'left',cursor:'pointer'}}><span>Purchase Value</span><b>{money(totals.purchaseTotal)}</b><small>HPCL purchase register — क्लिक करके खोलें</small></button><button type="button" className="attention-card" onClick={()=>setPage('Collection Detail')} style={{width:'100%',textAlign:'left',cursor:'pointer'}}><span>Unreconciled Sales Difference</span><b>{money(totals.unreconciledSalesDifference ?? totals.unallocatedSale)}</b><small>Sales − Credit − known receipts − pump expense — क्लिक करके खोलें</small></button><button type="button" className="attention-card" onClick={()=>setPage('Party Ledger')} style={{width:'100%',textAlign:'left',cursor:'pointer'}}><span>POS Party Match</span><b>{money(totals.posPartyMatched)}</b><small>POS excess matched with Party Ledger — क्लिक करके खोलें</small></button><button type="button" className="attention-card" onClick={()=>setPosDetailOpen(true)} style={{width:'100%',textAlign:'left',cursor:'pointer'}}>
        <span>POS Unmatched</span><b>{money(totals.posUnmatchedParty)}</b><small>Click करके date-wise details देखें</small>
      </button></section>
    {posDetailOpen && <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}} onClick={()=>setPosDetailOpen(false)}>
      <div className="pro-panel" style={{width:'min(900px,100%)',maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}} onClick={e=>e.stopPropagation()}>
        <div className="pro-panel-head" style={{position:'sticky',top:0,background:'inherit',zIndex:1}}>
          <div><h3>POS Unmatched — Date-wise Details</h3><span>POS excess जो Party Ledger से match नहीं हुआ</span></div>
          <button className="btn gray small" onClick={()=>setPosDetailOpen(false)}>✕ बंद करें</button>
        </div>
        <div style={{padding:'10px 0',fontSize:13}}>कुल Unmatched: <b>{money(posDetailTotal)}</b></div>
        {posDetailRows.length===0 ? <div className="attention-card ok"><span>कोई unmatched POS entry नहीं मिली</span></div> :
          <div className="table pro-table" style={{overflowX:'auto'}}><table><thead><tr><th>तारीख</th><th>Actual POS</th><th>Fuel POS</th><th>POS Excess</th><th>Party Match</th><th>Unmatched</th></tr></thead>
            <tbody>{posDetailRows.map(x=><tr key={x.date}><td>{x.date}</td><td>{money(x.actual)}</td><td>{money(x.fuel)}</td><td>{money(x.excess)}</td><td>{money(x.matched)}</td><td><b>{money(x.unmatched)}</b></td></tr>)}</tbody>
            <tfoot><tr className="total-row"><td>TOTAL</td><td colSpan="4">—</td><td>{money(posDetailTotal)}</td></tr></tfoot>
          </table></div>}
        <small style={{display:'block',marginTop:10,color:'#64748b'}}>यह केवल reconciliation view है; इस स्क्रीन से Cloud data में कोई बदलाव नहीं होता।</small>
      </div>
    </div>}
    </div>
    <div className="premium-lower-grid"><section className="pro-panel"><div className="pro-panel-head"><div><h3>Standard Accounting Flow</h3><span>Every transaction is classified into an account</span></div></div><div className="pro-info-row"><div className="pro-info green"><b>Sales</b><span>Cash/Bank or Trade Receivables are debited; Sales is credited.</span></div><div className="pro-info orange"><b>Purchases</b><span>Fuel inventory and eligible input tax are debited; Supplier Payable is credited.</span></div><div className="pro-info red"><b>Expenses</b><span>Expense is debited and the payment account is credited.</span></div></div><div className="table pro-table premium-table"><table><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{tb.slice(0,12).map(x=><tr key={x.account}><td>{x.account}</td><td>{money(x.debit)}</td><td>{money(x.credit)}</td><td>{money(x.balance)}</td></tr>)}</tbody></table></div></section><div className="premium-side-stack"><section className="pro-panel"><div className="pro-panel-head"><div><h3>Quick Actions</h3><span>Open module</span></div></div><div className="pro-quick-grid premium-quick">{quick.map(([i,l,p])=><button key={l} onClick={()=>setPage(p)}><span>{i}</span><b>{l}</b></button>)}</div></section><section className="pro-panel"><div className="pro-panel-head"><div><h3>Stock Quantity</h3><span>Operational quantity view</span></div><button className="pro-link" onClick={()=>setPage('Stock')}>Open →</button></div><div className="stock-cards"><div><span>MS</span><b>{(n(data.openingStock?.MS)+totals.filling.MS-totals.qty.MS).toFixed(0)} L</b></div><div><span>HSD</span><b>{(n(data.openingStock?.HSD)+totals.filling.HSD-totals.qty.HSD).toFixed(0)} L</b></div></div></section></div></div>
  </div>;
}

/* =========================================================
   FUEL SALE
========================================================= */

export function FuelSale({
  data,
  update
}) {
  // Safety guards keep Fuel Sale open even when an older backup has missing arrays.
  const sales = Array.isArray(data.sales) ? data.sales : [];
  const recoveries = Array.isArray(data.recoveries) ? data.recoveries : [];
  const dailyPayments = Array.isArray(data.dailyPayments) ? data.dailyPayments : [];

  const [date, setDate] =
    useState(todayDate());

  const [closings, setClosings] =
    useState({});

  // Saved meter rows can be edited individually.
  const [editingNozzles, setEditingNozzles] =
    useState({});

  const [testing, setTesting] =
    useState({});

  const [payments, setPayments] =
    useState(blankPays);

  const [recovery, setRecovery] =
    useState({
      MS:"",
      HSD:"",
      CNG:""
    });

  const [msg, setMsg] =
    useState("");

  const existing =
    sales.some(
      s => s.date === date
    );

  const oldPay =
    savedPayment(data, date);

  const oldRecovery = {
    MS:0,
    HSD:0,
    CNG:0
  };

  recoveries
    .filter(r => r.date === date)
    .forEach(r => {
      oldRecovery[r.fuel] =
        (oldRecovery[r.fuel] || 0) +
        n(r.amount);
    });

  useEffect(() => {
    // Prefer the most complete saved payment row for this date.
    // Legacy backups can contain duplicate rows where the last row only
    // has credit/zero values; selecting that row makes Payment Breakdown
    // appear blank even though a complete row exists.
    const paymentRowsForDate = dailyPayments.filter(
      r => String(r?.date || "") === String(date)
    );

    const paymentRowScore = row => {
      const fuels = ["MS", "HSD", "CNG"];

      return fuels.reduce((score, fuel) => {
        const p = row?.[fuel];
        if (!p || typeof p !== "object") return score;

        const keys = [
          "cash",
          "paytm",
          "card",
          "dtplus",
          "hppay",
          "phonepe",
          "credit",
          "pumpExpense",
          "other"
        ];

        return score + keys.reduce(
          (n, key) =>
            n + (p[key] !== undefined && p[key] !== "" ? 1 : 0),
          0
        );
      }, 0);
    };

    const p = paymentRowsForDate.reduce(
      (best, row) =>
        !best || paymentRowScore(row) > paymentRowScore(best)
          ? row
          : best,
      null
    ) || savedPayment(data, date);

    setPayments(
      p?.MS ||
      p?.HSD ||
      p?.CNG
        ? {
            MS:{
              ...blankPay(),
              ...(p.MS || {}),
              pumpExpense: (p.MS?.pumpExpense ?? p.MS?.other ?? ""),
              other: ""
            },

            HSD:{
              ...blankPay(),
              ...(p.HSD || {}),
              pumpExpense: (p.HSD?.pumpExpense ?? p.HSD?.other ?? ""),
              other: ""
            },

            CNG:{
              ...blankPay(),
              ...(p.CNG || {}),
              pumpExpense: (p.CNG?.pumpExpense ?? p.CNG?.other ?? ""),
              other: ""
            }
          }
        : blankPays()
    );

    setRecovery({
      MS:oldRecovery.MS || "",
      HSD:oldRecovery.HSD || "",
      CNG:oldRecovery.CNG || ""
    });

    setClosings({});
    setTesting({});
    setEditingNozzles({});
    setMsg("");

  }, [date, dailyPayments, recoveries]);

  const rows =
    NOZZLES.map(
      ([nozzle, fuel]) => {

        // If historical/local data contains more than one row for the same
        // date + nozzle, Fuel Sale must display the latest genuine saved row.
        // Array.find() could show an older Testing=0 row and hide restored edits.
        const saved = typeof sales.findLast === "function"
          ? sales.findLast(s => s.date === date && s.nozzle === nozzle)
          : [...sales].reverse().find(s => s.date === date && s.nozzle === nozzle);

        // Opening हमेशा सबसे हाल की पिछली sale की Closing से आएगी.
        const opening = openingFor(
          data,
          nozzle,
          date
        );

        const closing =
          closings[nozzle] !== undefined
            ? closings[nozzle]
            : saved
              ? n(saved.closing)
              : "";

        const test =
          testing[nozzle] !== undefined
            ? n(testing[nozzle])
            : saved
              ? n(saved.testing)
              : 0;

        const rawMeter =
          closing === "" ? 0 : n(closing) - opening;
        const meter = rawMeter < 0 ? 0 : rawMeter;
        const qty = rawMeter < 0 ? 0 : Math.max(0, meter - test);

        const rate =
  getRate(data, fuel, date);
        return {
          nozzle,
          fuel,
          opening,
          closing,
          testing:test,
          meterQty:meter,
          qty,
          rate,
          amount:rupee(qty * rate),
          invalidMeter: closing !== "" && n(closing) < opening,
          saved:!!saved
        };
      }
    );

  const saleTotals = {
    MS:0,
    HSD:0,
    CNG:0
  };

  rows.forEach(r => {
    saleTotals[r.fuel] +=
      n(r.amount);
  });

  const totalSale =
    saleTotals.MS +
    saleTotals.HSD +
    saleTotals.CNG;

  const creditByFuel = {
    MS: creditTotalForFuel(data, date, "MS"),
    HSD: creditTotalForFuel(data, date, "HSD"),
    CNG: creditTotalForFuel(data, date, "CNG")
  };

  const paymentTotal =
    fuel =>
      payTotal({
        ...payments[fuel],
        credit: creditByFuel[fuel]
      });

  const diff = {
    MS: rupee(saleTotals.MS - (accountedTotal({ ...payments.MS, credit: creditByFuel.MS }) + n(payments.MS?.pumpExpense) + n(payments.MS?.densityExpense) + n(payments.MS?.jump))),
    HSD: rupee(saleTotals.HSD - (accountedTotal({ ...payments.HSD, credit: creditByFuel.HSD }) + n(payments.HSD?.pumpExpense) + n(payments.HSD?.densityExpense) + n(payments.HSD?.jump))),
    CNG: rupee(saleTotals.CNG - (accountedTotal({ ...payments.CNG, credit: creditByFuel.CNG }) + n(payments.CNG?.pumpExpense) + n(payments.CNG?.jump)))
  };

  const totalPayment =
    rupee(
      paymentTotal("MS") +
      paymentTotal("HSD") +
      paymentTotal("CNG")
    );

  const totalPumpExpense = rupee(
    n(payments.MS?.pumpExpense) + n(payments.MS?.other) +
    n(payments.HSD?.pumpExpense) + n(payments.HSD?.other) +
    n(payments.CNG?.pumpExpense) + n(payments.CNG?.other)
  );

  const totalDensityExpense = n(payments.MS?.densityExpense) + n(payments.HSD?.densityExpense);
  const totalJump = n(payments.MS?.jump) + n(payments.HSD?.jump) + n(payments.CNG?.jump);
  const totalDifference = rupee(
    totalSale - totalPayment - totalPumpExpense - totalDensityExpense - totalJump
  );

  const pending =
    previousPending(
      data,
      date
    );

  function editRow(r) {
    if (!r.saved) return;

    setEditingNozzles(x => ({
      ...x,
      [r.nozzle]: true
    }));

    setClosings(x => ({
      ...x,
      [r.nozzle]: String(r.closing)
    }));

    setTesting(x => ({
      ...x,
      [r.nozzle]: String(r.testing ?? "")
    }));

    setMsg(`${r.nozzle} edit mode में है। Closing/Testing बदलकर Save Daily Sale दबाएँ।`);
  }

  function deleteRow(r) {
    if (!r.saved) {
      setClosings(x => {
        const next = { ...x };
        delete next[r.nozzle];
        return next;
      });
      setTesting(x => {
        const next = { ...x };
        delete next[r.nozzle];
        return next;
      });
      return;
    }

    if (!window.confirm(`${r.nozzle} की ${date} की meter entry delete करें?`)) return;

    const remainingSales = sales.filter(
      s => !(s.date === date && s.nozzle === r.nozzle)
    );

    // Keep the payment breakup, but refresh its totals/difference
    // so deleting one nozzle does not leave an old payment total.
    const old = savedPayment(data, date);
    let nextDailyPayments = dailyPayments;

    if (old) {
      const nextPayment = { ...old };
      ["MS", "HSD", "CNG"].forEach(fuel => {
        const sale = rupee(remainingSales
          .filter(s => s.date === date && s.fuel === fuel)
          .reduce((sum, s) => sum + n(s.amount), 0));

        const credit = creditTotalForFuel(data, date, fuel);
        const breakup = {
          ...blankPay(),
          ...(old[fuel] || {})
        };
        const total = payTotal({ ...breakup, credit });

        nextPayment[fuel] = {
          ...breakup,
          credit,
          total,
          difference: rupee(sale - accountedTotal({ ...breakup, credit }))
        };
      });

      nextPayment.total = rupee(
        nextPayment.MS.total +
        nextPayment.HSD.total +
        nextPayment.CNG.total
      );

      nextPayment.salesmanPending = {
        MS: Math.max(0, nextPayment.MS.difference),
        HSD: Math.max(0, nextPayment.HSD.difference),
        CNG: Math.max(0, nextPayment.CNG.difference)
      };

      let replaced = false;
      nextDailyPayments = dailyPayments.map((p, i, arr) => {
        const isLastForDate = String(p?.date || '') === String(date) &&
          !arr.slice(i + 1).some(x => String(x?.date || '') === String(date));
        if (isLastForDate) { replaced = true; return nextPayment; }
        return p;
      });
      if (!replaced) nextDailyPayments = [...nextDailyPayments, nextPayment];
    }

    update({
      sales: remainingSales,
      dailyPayments: nextDailyPayments
    });

    setEditingNozzles(x => {
      const next = { ...x };
      delete next[r.nozzle];
      return next;
    });
    setClosings(x => {
      const next = { ...x };
      delete next[r.nozzle];
      return next;
    });
    setTesting(x => {
      const next = { ...x };
      delete next[r.nozzle];
      return next;
    });

    setMsg(`${r.nozzle} की ${date} की meter entry delete हो गई।`);
  }

  function saveRecoveryOnly() {
    setMsg("");

    const recoveryTotal =
      n(recovery.MS) +
      n(recovery.HSD) +
      n(recovery.CNG);

    if (recoveryTotal <= 0) {
      return setMsg("Recovery amount डालें.");
    }

    for (const f of ["MS", "HSD", "CNG"]) {
      const amount = n(recovery[f]);
      if (amount <= 0) continue;
      if (amount > pending[f] + 0.50) {
        return setMsg(
          f + ": आज की Recovery " +
          money(amount) +
          " है, जबकि Previous Receivable Difference केवल " +
          money(pending[f]) +
          " है."
        );
      }
    }

    const newRecoveries = [];
    ["MS", "HSD", "CNG"].forEach((fuel, i) => {
      const amount = n(recovery[fuel]);
      if (amount > 0) {
        newRecoveries.push({
          id: Date.now() + i,
          date,
          fuel,
          amount,
          againstPending: pending[fuel],
          note: "Previous salesman pending recovery"
        });
      }
    });

    update({
      recoveries: [
        ...recoveries.filter(r => r.date !== date),
        ...newRecoveries
      ]
    });

    setRecovery({ MS: "", HSD: "", CNG: "" });
    setMsg("Recovery Saved: " + money(recoveryTotal));
  }


  function saveDaily() {

    setMsg("");

    if (date < START_DATE) {
      return setMsg(
        "01-08-2026 से पहले की date allowed नहीं है."
      );
    }

    if (
      !existing &&
      !rows.some(
        r =>
          String(r.closing) !== ""
      )
    ) {
      return setMsg(
        "कम से कम एक nozzle की Closing Reading डालें."
      );
    }

    const bad =
      rows.find(
        r =>
          String(r.closing) !== "" &&
          n(r.closing) < r.opening
      );

    if (bad) {
      return setMsg(
        `${bad.nozzle}: Closing reading opening से कम नहीं हो सकती.`
      );
    }

    const badTest =
      rows.find(
        r =>
          !r.saved &&
          r.testing > r.meterQty
      );

    if (badTest) {
      return setMsg(
        `${badTest.nozzle}: Testing quantity meter sale से ज्यादा नहीं हो सकती.`
      );
    }

    // Receipt total may be higher or lower than fuel sale. Both are saved.
    // The difference is calculated after adding back any Pump Expense paid before cash deposit; it is never blocked.

    const ts = Date.now();

    const newSales =
      rows
        .filter(
          r =>
            String(r.closing) !== ""
        )
        .map((r, i) => ({
          id:
            sales.find(
              s =>
                s.date === date &&
                s.nozzle === r.nozzle
            )?.id || (ts + i),
          date,
          shift:
            "06:00 AM - 11:00 PM",
          fuel:r.fuel,
          nozzle:r.nozzle,
          opening:r.opening,
          closing:n(r.closing),
          testing:n(r.testing),
          qty:n(r.qty),
          rate:n(r.rate),
          amount:n(r.amount)
        }));

    const updatedSales = [
      ...sales.filter(
        s => s.date !== date
      ),
      ...newSales
    ];

    const payment = {
      id:
        oldPay?.id ||
        ts + 100,

      date,

      MS:{
        ...payments.MS,
        credit:creditByFuel.MS,
        total:
          paymentTotal("MS"),
        difference:
          diff.MS
      },

      HSD:{
        ...payments.HSD,
        credit:creditByFuel.HSD,
        total:
          paymentTotal("HSD"),
        difference:
          diff.HSD
      },

      CNG:{
        ...payments.CNG,
        credit:creditByFuel.CNG,
        total:
          paymentTotal("CNG"),
        difference:
          diff.CNG
      },

      total:totalPayment,

    };

    const dp = [
      ...dailyPayments
    ];

    const idx =
      dp.findIndex(
        p => p.date === date
      );

    if (idx >= 0) {
      dp[idx] = payment;
    } else {
      dp.push(payment);
    }

    update({
      sales:updatedSales,
      dailyPayments:dp
    });

    setMsg(
      `Daily Sale Saved: ${money(
        totalSale
      )} | ${
        newSales.length
      } nozzle entries | Recovery: ${money(
        n(recovery.MS) +
        n(recovery.HSD) +
        n(recovery.CNG)
      )}`
    );
  }

  return (
    <div className="content">

      <section className="panel">

        <h2>
          Daily Meter Readings
        </h2>

        <p>
          Testing quantity sale से घटेगी.
          Saved date को meter readings
          दोबारा add नहीं होंगी.
        </p>

        <div
          className="form"
          style={{
            marginBottom:18
          }}
        >

          <Field label="Date">

            <input
              type="date"
              min={START_DATE}
              value={date}
              onChange={e =>
                setDate(
                  e.target.value
                )
              }
            />

          </Field>

          <Field label="Shift">

            <input
              className="readonly"
              readOnly
              value="06:00 AM - 11:00 PM"
            />

          </Field>

        </div>

        <div className="table meter-table">

          <table>

            <thead>

              <tr>
                <th>Nozzle</th>
                <th>Fuel</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Meter Qty</th>
                <th>Testing</th>
                <th>Sale Qty</th>
                <th>Rate</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>

            </thead>

            <tbody>

              {rows.map(r => (

                <tr key={r.nozzle}>

                  <td>
                    <b>{r.nozzle}</b>
                  </td>

                  <td>{r.fuel}</td>

                  <td>{r.opening}</td>

                  <td style={r.invalidMeter ? {border:'2px solid #dc2626',background:'#fef2f2'} : undefined} title={r.invalidMeter ? 'Invalid meter reading: Closing is below Opening' : undefined}>
                    {r.saved && !editingNozzles[r.nozzle]
                      ? (
                        <b>
                          {r.closing}
                        </b>
                      )
                      : (
                        <input
                          type="number"
                          step=".001"
                          value={
                            r.closing
                          }
                          onChange={e =>
                            setClosings(
                              x => ({
                                ...x,
                                [r.nozzle]:
                                  e.target.value
                              })
                            )
                          }
                        />
                      )}
                  </td>

                  <td>
                    {r.invalidMeter ? (
                      <b style={{color:'#dc2626'}}>INVALID</b>
                    ) : r.meterQty.toFixed(
                      r.fuel === "CNG"
                        ? 3
                        : 2
                    )}
                    {r.invalidMeter && <div style={{fontSize:11,color:'#dc2626',fontWeight:700}}>Closing &lt; Opening</div>}
                  </td>

                  <td>

                    {r.saved && !editingNozzles[r.nozzle]
                      ? r.testing
                      : (
                        <input
                          type="number"
                          step={
                            r.fuel === "CNG"
                              ? ".001"
                              : ".01"
                          }
                          value={
                            testing[
                              r.nozzle
                            ] ?? ""
                          }
                          onChange={e =>
                            setTesting(
                              x => ({
                                ...x,
                                [r.nozzle]:
                                  e.target.value
                              })
                            )
                          }
                        />
                      )}

                  </td>

                  <td>
                    {r.qty.toFixed(
                      r.fuel === "CNG"
                        ? 3
                        : 2
                    )}
                  </td>

                  <td>
                    {money(r.rate)}
                  </td>

                  <td>
                    <b>
                      {money(r.amount)}
                    </b>
                  </td>

                  <td>
  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
    {r.saved && (
      <button
        type="button"
        className="btn small"
        onClick={() => editRow(r)}
      >
        ✏️ Edit
      </button>
    )}

    <button
      type="button"
      className="btn red small"
      onClick={() => deleteRow(r)}
    >
      🗑️ Delete
    </button>

    {editingNozzles[r.nozzle] && (
      <button
        type="button"
        className="btn gray small"
        onClick={() => {
          setEditingNozzles(x => { const next = {...x}; delete next[r.nozzle]; return next; });
          setClosings(x => { const next = {...x}; delete next[r.nozzle]; return next; });
          setTesting(x => { const next = {...x}; delete next[r.nozzle]; return next; });
          setMsg("");
        }}
      >
        Cancel
      </button>
    )}
  </div>
</td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

        <div className="total-box">

          <div className="mini">
            <span>
              MS TOTAL
            </span>

            <strong>
              {rows
                .filter(
                  r => r.fuel === "MS"
                )
                .reduce(
                  (a,r) =>
                    a + r.qty,
                  0
                )
                .toFixed(2)} L
            </strong>
          </div>

          <div className="mini">
            <span>
              HSD TOTAL
            </span>

            <strong>
              {rows
                .filter(
                  r => r.fuel === "HSD"
                )
                .reduce(
                  (a,r) =>
                    a + r.qty,
                  0
                )
                .toFixed(2)} L
            </strong>
          </div>

          <div className="mini">
            <span>
              CNG TOTAL
            </span>

            <strong>
              {rows
                .filter(
                  r => r.fuel === "CNG"
                )
                .reduce(
                  (a,r) =>
                    a + r.qty,
                  0
                )
                .toFixed(3)} Kg
            </strong>
          </div>

          <div className="mini">
            <span>
              TOTAL SALE
            </span>

            <strong>
              {money(totalSale)}
            </strong>
          </div>

        </div>

      </section>

      <PaymentSection
        fuel="MS"
        payments={payments}
        setPayments={setPayments}
        saleTotals={saleTotals}
        paymentTotal={paymentTotal}
        diff={diff}
        creditTotal={creditByFuel.MS}
      />

      <PaymentSection
        fuel="HSD"
        payments={payments}
        setPayments={setPayments}
        saleTotals={saleTotals}
        paymentTotal={paymentTotal}
        diff={diff}
        creditTotal={creditByFuel.HSD}
      />

      <PaymentSection
        fuel="CNG"
        payments={payments}
        setPayments={setPayments}
        saleTotals={saleTotals}
        paymentTotal={paymentTotal}
        diff={diff}
        creditTotal={creditByFuel.CNG}
      />

      <section
        className="panel"
        style={{
          marginTop:18
        }}
      >

        <div className="warning" style={{marginBottom:12}}>
          <b>Accounting:</b> Receipts, receivables and expenses are posted to separate accounts.
        </div>

        <h2>
          Daily Payment Summary
        </h2>

        <div className="total-box">

          <div className="mini">
            <span>
              TOTAL SALE
            </span>

            <strong>
              {money(totalSale)}
            </strong>
          </div>

          <div className="mini">
            <span>
              TOTAL PAYMENT RECEIVED
            </span>

            <strong>
              {money(totalPayment)}
            </strong>
          </div>

          <div className="mini">
            <span>
              TOTAL DIFFERENCE
            </span>

            <strong>
              {money(totalDifference)}
            </strong>
          </div>

          <div className="mini">
            <span>
              STATUS
            </span>

            <strong>
              {Math.abs(
                totalDifference
              ) <= 0.50
                ? "OK"
                : "CHECK"}
            </strong>
          </div>

        </div>

        <div className="actions">

          <button
            className="btn"
            onClick={saveDaily}
          >
            💾 Save Complete Daily Sale
          </button>

        </div>

        {msg && (
          <div
            className={
              msg.includes("Saved")
                ? "notice"
                : "notice error"
            }
          >
            {msg}
          </div>
        )}

      </section>

    </div>
  );
}


/* =========================================================
   PAYMENT SECTION
   यह function केवल एक बार है
========================================================= */

// Density/JUMP patch 17-09-2026
export function PaymentSection({
  fuel,
  payments,
  setPayments,
  saleTotals,
  paymentTotal,
  diff,
  creditTotal
}) {
  const paymentMethods = [
    ["cash", "Cash"], ["paytm", "Paytm"], ["card", "ATM / Card"],
    ["dtplus", "DT Plus"], ["hppay", "HP Pay"], ["phonepe", "PhonePe"],
    ["credit", "Party Receivable / Credit"], ["pumpExpense", "Expense"]
  ];
  const digital = ["paytm","card","dtplus","hppay","phonepe"]
    .reduce((a,k)=>a+n(payments[fuel]?.[k]),0);
  const expense=n(payments[fuel]?.pumpExpense);
  const densityExpense = (fuel === "MS" || fuel === "HSD") ? n(payments[fuel]?.densityExpense) : 0;
  const jump = n(payments[fuel]?.jump);
  const setField=(key,value)=>setPayments(p=>({...p,[fuel]:{...p[fuel],[key]:value}}));

  return <section className="panel" style={{marginTop:18}}>
    <h2>{fuel} Payment Breakdown</h2>
    <p>Actual receiving अलग भरें. Density केवल MS/HSD के लिए है; JUMP MS/HSD/CNG में अलग दर्ज होगी.</p>
    <div className="form">
      {paymentMethods.map(([k,l])=><Field key={k} label={l}>
        <input type="number" step=".01" value={k==="credit"?creditTotal:(payments[fuel]?.[k]??"")} readOnly={k==="credit"} className={k==="credit"?"readonly":""}
          onChange={e=>k!=="credit"&&setField(k,e.target.value)} />
      </Field>)}
    </div>
    <div className="actions" style={{marginTop:10}}>
      {(fuel === "MS" || fuel === "HSD") && <button type="button" className="btn" onClick={()=>setField("densityOpen",!payments[fuel]?.densityOpen)}>🧪 Density</button>}
      <button type="button" className="btn" onClick={()=>setField("jumpOpen",!payments[fuel]?.jumpOpen)}>↕️ JUMP</button>
    </div>
    {payments[fuel]?.densityOpen && (fuel === "MS" || fuel === "HSD") && <div className="form" style={{marginTop:10}}>
      <Field label={`Density — ${fuel} Reading`}><input value={payments[fuel]?.densityReading??""} placeholder="जैसे 0.7420" onChange={e=>setField("densityReading",e.target.value)} /></Field>
      <Field label={`Density — ${fuel} Expense (₹)`}><input type="number" step=".01" min="0" value={payments[fuel]?.densityExpense??""} placeholder="वास्तविक खर्च" onChange={e=>setField("densityExpense",e.target.value)} /></Field>
    </div>}
    {payments[fuel]?.jumpOpen && <div className="form" style={{marginTop:10}}>
      <Field label={`JUMP — ${fuel} (₹)`}><input type="number" step=".01" min="0" value={payments[fuel]?.jump??""} placeholder="वास्तविक JUMP राशि" onChange={e=>setField("jump",e.target.value)} /></Field>
    </div>}
    <div className="total-box">
      <div className="mini"><span>SALE</span><strong>{money(saleTotals[fuel])}</strong></div>
      <div className="mini"><span>PAYMENT</span><strong>{money(paymentTotal(fuel))}</strong></div>
      <div className="mini"><span>CASH</span><strong>{money(payments[fuel]?.cash)}</strong></div>
      <div className="mini"><span>DIGITAL</span><strong>{money(digital)}</strong></div>
      <div className="mini"><span>DENSITY EXPENSE</span><strong>{money(densityExpense)}</strong></div>
      <div className="mini"><span>JUMP</span><strong>{money(jump)}</strong></div>
      <div className="mini"><span>EXPENSE</span><strong>{money(expense)}</strong></div>
    </div>
    {Math.abs(diff[fuel])<=0.50?<div className="balance-ok">✓ {fuel} Payment matches Sale — Difference ₹0.00</div>:<div className="balance-bad">⚠ {fuel} Difference: {money(diff[fuel])}</div>}
  </section>;
}

export function OpeningSetup({
  data,
  update,
  session
}) {

  const reset = () => {
    if (session?.role !== USER_ROLES.ADMIN) return;
    if (window.confirm(
        "सारा local ERP data reset करना है?"
    )) {

      localStorage.removeItem(KEY);

      update(
        initialData()
      );

    }
  };

  return (
    <div className="content">

      <div className="warning">

        <b>
          01-08-2026 Opening Setup
        </b>

        <br />

        MS/HSD stock और nozzle openings
        fixed हैं. CNG stock maintain
        नहीं होगा.

      </div>

      <div className="grid">

        <section className="panel">

          <h3>
            Fuel Stock Opening
          </h3>

          <div className="form">

            <Field label="MS">
              <input
                className="readonly"
                readOnly
                value={`${n(data.openingStock?.MS ?? 9356)} L`}
              />
            </Field>

            <Field label="HSD">
              <input
                className="readonly"
                readOnly
                value={`${n(data.openingStock?.HSD ?? 7500)} L`}
              />
            </Field>

            <Field label="CNG">
              <input
                className="readonly"
                readOnly
                value="No Stock"
              />
            </Field>

          </div>

        </section>

        <section className="panel">

          <h3>
            Rates
          </h3>

          <div className="form">

            {[
              "MS",
              "HSD",
              "CNG"
            ].map(f => (

              <Field
                key={f}
                label={f}
              >

                <input
                  className="readonly"
                  readOnly
                  value={
                    data.rates[f]
                  }
                />

              </Field>

            ))}

          </div>

        </section>

      </div>

      <section
        className="panel"
        style={{
          marginTop:18
        }}
      >

        <h3>
          Nozzle Opening Readings
        </h3>

        <Table
          headers={[
            "Nozzle",
            "Fuel",
            "01-08-2026 Opening"
          ]}
          rows={
            NOZZLES.map(
              x => [
                x[0],
                x[1],
                OPENING[x[0]]
              ]
            )
          }
        />

      </section>

      <div className="actions">

        {session?.role === USER_ROLES.ADMIN && <button className="btn red" onClick={reset}>Reset Local Data</button>}

      </div>

    </div>
  );
}


/* =========================================================
   PARTY MASTER
========================================================= */


export function PartyMaster({
  data,
  update
}) {

  const empty = {
    name:"",
    mobile:"",
    gst:"",
    limit:""
  };

  const [f, setF] =
    useState(empty);

  const [editId, setEditId] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [per, setPer] =
    useState(20);

  const [msg, setMsg] =
    useState("");

  const filtered =
    data.parties.filter(p => {

      const q =
        search
          .toLowerCase()
          .trim();

      return (
        !q ||
        [
          p.name,
          p.mobile,
          p.gst
        ].some(v =>
          String(v || "")
            .toLowerCase()
            .includes(q)
        )
      );
    });

  const pages =
    Math.max(
      1,
      Math.ceil(
        filtered.length / per
      )
    );

  const list =
    filtered.slice(
      (page - 1) * per,
      page * per
    );

  useEffect(
    () => setPage(1),
    [search, per]
  );

  function save() {

    const name =
      f.name.trim();

    if (!name) {
      return setMsg(
        "Party name जरूरी है."
      );
    }

    if (
      data.parties.some(
        p =>
          p.id !== editId &&
          p.name
            .trim()
            .toLowerCase() ===
          name.toLowerCase()
      )
    ) {
      return setMsg(
        "यह party पहले से मौजूद है."
      );
    }

    if (editId !== null) {

      update({
        parties:
          data.parties.map(
            p =>
              p.id === editId
                ? {
                    ...p,
                    ...f,
                    name
                  }
                : p
          )
      });

    } else {

      update({
        parties:[
          ...data.parties,
          {
            ...f,
            name,
            id:Date.now()
          }
        ]
      });

    }

    setF(empty);
    setEditId(null);

    setMsg(
      editId !== null
        ? "Party updated."
        : "Party added."
    );
  }

  function edit(p) {

    setF({
      name:p.name || "",
      mobile:p.mobile || "",
      gst:p.gst || "",
      limit:p.limit || ""
    });

    setEditId(p.id);
    setMsg("");
  }

  function del(id) {

    const p =
      data.parties.find(
        x => x.id === id
      );

    if (
      p &&
      window.confirm(
        `"${p.name}" delete करना है?`
      )
    ) {

      update({
        parties:
          data.parties.filter(
            x => x.id !== id
          )
      });

      if (editId === id) {
        setEditId(null);
        setF(empty);
      }

      setMsg(
        "Party deleted."
      );
    }
  }

  return (
    <div className="content">

      <section className="panel">

        <h2>
          Party Master
          {editId !== null
            ? " — Edit Party"
            : ""}
        </h2>

        <div className="form">

          <Field label="NAME *">

            <input
              value={f.name}
              onChange={e =>
                setF({
                  ...f,
                  name:e.target.value
                })
              }
            />

          </Field>

          <Field label="MOBILE">

            <input
              inputMode="numeric"
              value={f.mobile}
              onChange={e =>
                setF({
                  ...f,
                  mobile:e.target.value
                })
              }
            />

          </Field>

          <Field label="GST">

            <input
              value={f.gst}
              onChange={e =>
                setF({
                  ...f,
                  gst:
                    e.target.value
                      .toUpperCase()
                })
              }
            />

          </Field>

          <Field label="CREDIT LIMIT">

            <input
              type="number"
              step=".01"
              value={f.limit}
              onChange={e =>
                setF({
                  ...f,
                  limit:
                    e.target.value
                })
              }
            />

          </Field>

        </div>

        <div className="actions">

          <button
            className="btn"
            onClick={save}
          >
            {editId !== null
              ? "✓ Update Party"
              : "＋ Add Party"}
          </button>

          {editId !== null && (
            <button
              className="btn gray"
              onClick={() => {
                setEditId(null);
                setF(empty);
              }}
            >
              Cancel
            </button>
          )}

          <button
            className="btn gray"
            onClick={() => {
              setEditId(null);
              setF(empty);
            }}
          >
            Clear
          </button>

        </div>

        {msg && (
          <div
            className={
              msg.includes("जरूरी") ||
              msg.includes("पहले से")
                ? "notice error"
                : "notice"
            }
          >
            {msg}
          </div>
        )}

      </section>

      <section
        className="panel"
        style={{
          marginTop:18
        }}
      >

        <div
          style={{
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
            gap:10,
            flexWrap:"wrap"
          }}
        >

          <h2>
            Party List ({filtered.length})
          </h2>

          <input
            className="search"
            placeholder="Search party / mobile / GST..."
            value={search}
            onChange={e =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

        <Table
          headers={[
            "#",
            "Party",
            "Mobile",
            "GST",
            "Limit",
            "Actions"
          ]}
          rows={
            list.map(
              (p, i) => [
                <b>
                  {(page - 1) *
                    per +
                    i +
                    1}
                </b>,

                <b>
                  {p.name}
                </b>,

                p.mobile || "—",

                p.gst || "—",

                money(p.limit),

                <span
                  style={{
                    display:"flex",
                    gap:6
                  }}
                >

                  <button
                    className="btn small"
                    onClick={() =>
                      edit(p)
                    }
                  >
                    ✎ Edit
                  </button>

                  <button
                    className="btn red small"
                    onClick={() =>
                      del(p.id)
                    }
                  >
                    🗑 Delete
                  </button>

                </span>
              ]
            )
          }
        />

        <div className="pagination">

          <button
            disabled={page === 1}
            onClick={() =>
              setPage(1)
            }
          >
            «
          </button>

          <button
            disabled={page === 1}
            onClick={() =>
              setPage(page - 1)
            }
          >
            ‹
          </button>

          {Array.from(
            {
              length:pages
            },
            (_, i) => i + 1
          )
            .slice(
              Math.max(
                0,
                page - 3
              ),
              Math.min(
                pages,
                page + 2
              )
            )
            .map(x => (

              <button
                className={
                  x === page
                    ? "active"
                    : ""
                }
                key={x}
                onClick={() =>
                  setPage(x)
                }
              >
                {x}
              </button>

            ))}

          <button
            disabled={
              page === pages
            }
            onClick={() =>
              setPage(page + 1)
            }
          >
            ›
          </button>

          <button
            disabled={
              page === pages
            }
            onClick={() =>
              setPage(pages)
            }
          >
            »
          </button>

          <span
            style={{
              marginLeft:"auto"
            }}
          >
            Rows{" "}

            <select
              value={per}
              onChange={e =>
                setPer(
                  Number(
                    e.target.value
                  )
                )
              }
            >
              <option>10</option>
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </select>

          </span>

        </div>

        <p>
          Total {data.parties.length}
          {" "}parties
        </p>

      </section>

    </div>
  );
}


/* =========================================================
   CREDIT SALE
========================================================= */



/* =========================================================
   CREDIT SALE
========================================================= */


export function CreditSale({
  data,
  update
}) {

  const [f, setF] =
    useState({
      date:todayDate(),
      parchiNo:"",
      invoiceNo:"",
      party:"",
      vehicle:"",
      fuel:"MS",
      productName:"",
      qty:"",
      packQty:"",
      packSize:"",
      manualAmount:""
    });

  const [msg, setMsg] =
    useState("");

  // Lubricant products come from uploaded/saved purchase bills.
  const lubricantProductOptions = useMemo(() => {
    const map = new Map();
    (data.purchases || []).filter(p => String(p?.fuel || "").toUpperCase() === "LUBRICANT").forEach(p => {
      const items = Array.isArray(p.items) && p.items.length ? p.items : [{ description: p.productName || "Mobile Oil (HPCL)", hsn: p.hsn || "" }];
      items.forEach(item => {
        const rawName = String(item?.description || "").trim();
        const name = normalizeLubricantProductName(rawName);
        if (!name) return;
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, { name, hsn: String(item?.hsn || "").trim(), invoiceNo: String(p.invoiceNo || "").trim() });
      });
    });
    return Array.from(map.values());
  }, [data.purchases]);

  const [editId, setEditId] =
    useState(null);

  const creditRate = f.fuel === "LUBRICANT" ? 0 : getRate(data, f.fuel, f.date);

  const LUBRICANT_GST_RATE = 18;
  // Lubricant sale amount entered by the user is the FINAL/GROSS invoice amount,
  // inclusive of GST. Taxable value and GST are derived from that final amount.
  const lubricantGrossPreview = f.fuel === "LUBRICANT" ? rupee(n(f.manualAmount)) : 0;
  const lubricantTaxablePreview = f.fuel === "LUBRICANT" ? rupee(lubricantGrossPreview * 100 / (100 + LUBRICANT_GST_RATE)) : 0;
  const lubricantGstPreview = f.fuel === "LUBRICANT" ? rupee(lubricantGrossPreview - lubricantTaxablePreview) : 0;
  const lubricantSaleQty = (f.fuel === "LUBRICANT" && n(f.packQty)>0 && n(f.packSize)>0) ? rupee(n(f.packQty)*n(f.packSize)) : n(f.qty);
  const amount = f.fuel === "LUBRICANT" ? lubricantGrossPreview : rupee(n(f.qty) * creditRate);

  function save() {

    if (!f.party || !f.parchiNo) {
      return setMsg("Manual Parchi No और Party जरूरी हैं.");
    }
    if (f.fuel === "LUBRICANT") {
      if (!f.invoiceNo.trim()) return setMsg("Lubricant Sale में Invoice No. जरूरी है.");
      if (lubricantSaleQty <= 0) return setMsg("Lubricant Sale में Qty जरूरी है.");
      if (!f.productName.trim()) return setMsg("Lubricant / Product Name जरूरी है.");
      if (n(f.manualAmount) <= 0) return setMsg("Lubricant Credit Sale में Amount ₹0 से अधिक होना चाहिए.");
    } else if (n(f.qty) <= 0) {
      return setMsg("Fuel Credit Sale में Qty जरूरी है.");
    }
    if (!isValidISODate(f.date) || f.date < START_DATE) {
      return setMsg("Date valid YYYY-MM-DD होनी चाहिए और 01-08-2026 से पहले नहीं हो सकती।");
    }
    const normalizedParchi = String(f.parchiNo).trim();
    const duplicateParchi = (data.credits || []).some(c =>
      String(c?.parchiNo || "").trim().toLowerCase() === normalizedParchi.toLowerCase() &&
      c.id !== editId
    );
    if (duplicateParchi) {
      return setMsg(`Parchi No. ${normalizedParchi} पहले से मौजूद है। Duplicate entry save नहीं की गई।`);
    }

    const record = {
      date: f.date,
      parchiNo: normalizedParchi,
      invoiceNo: f.fuel === "LUBRICANT" ? String(f.invoiceNo || "").trim() : "",
      party: f.party,
      vehicle: f.vehicle.toUpperCase(),
      fuel: f.fuel,
      productName: f.fuel === "LUBRICANT" ? f.productName.trim() : "",
      qty: f.fuel === "LUBRICANT" ? lubricantSaleQty : n(f.qty),
      // Invoice Rate for lubricant is GST-inclusive gross rate per litre.
      rate: f.fuel === "LUBRICANT" ? (lubricantSaleQty > 0 ? rupee(lubricantGrossPreview / lubricantSaleQty) : 0) : creditRate,
      amount,
      ...(f.fuel === "LUBRICANT" ? { taxableAmount:lubricantTaxablePreview, gstRate:LUBRICANT_GST_RATE, gstAmount:lubricantGstPreview } : {})
    };

    if (editId !== null) {
      const oldRow = data.credits.find(c => c.id === editId);
      if (!oldRow) return setMsg("Credit Sale edit record नहीं मिला।");
      // Editing a protected transaction changes its signed business content.
      // Recompute the v2 fingerprint before passing the row to the integrity firewall.
      const updatedRow = {
        ...oldRow,
        ...record,
        fingerprint: transactionFingerprint("CREDIT_SALE", { ...oldRow, ...record }),
        fingerprintVersion: 2
      };
      update({ credits: data.credits.map(c => c.id === editId ? updatedRow : c) }).then?.(result => {
        if (result?.ok === false) setMsg(`❌ Credit Sale update नहीं हुआ: ${result.reason || "Mutation rejected"}`);
      });
      setMsg("Credit Sale updated successfully.");
      setEditId(null);
    } else {
      update({ credits: [...data.credits, { id: Date.now(), ...record }] });
      setMsg("Credit Sale saved successfully.");
    }

    setF({ ...f, parchiNo: "", invoiceNo: "", party: "", vehicle: "", productName: "", qty: "", packQty: "", packSize: "", manualAmount: "" });
  }

  function exportCreditExcel() {
    const esc = v => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const lines = [
      ["SATAT FILLING STATION"].map(esc).join(","),
      ["Credit Sale Register"].map(esc).join(","),
      ["Date","Parchi No","Party","Vehicle","Fuel","Product","Qty","Rate","Amount"].map(esc).join(",")
    ];
    data.credits.slice().reverse().forEach(c => lines.push([c.date,c.parchiNo,c.party,c.vehicle,c.fuel,c.productName||"",n(c.qty),n(c.rate ?? (n(c.amount)/Math.max(n(c.qty),1))),n(c.amount)].map(esc).join(",")));
    const blob=new Blob(["\uFEFF"+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;
    a.download=`Credit_Sale_Register_${todayDate()}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function printCreditPdf() {
    const body=data.credits.slice().reverse().map(c=>`<tr><td>${c.date||""}</td><td>${c.parchiNo||""}</td><td>${c.party||""}</td><td>${c.vehicle||""}</td><td>${c.fuel||""}</td><td>${c.productName||"—"}</td><td>${n(c.qty).toFixed(c.fuel==="CNG"?3:2)}</td><td>${money(n(c.rate ?? (n(c.amount)/Math.max(n(c.qty),1))))}</td><td>${moneyRupee(c.amount)}</td></tr>`).join("");
    const w=window.open("","_blank"); if(!w){alert("Print window blocked है. Browser में pop-up allow करें.");return;}
    w.document.write(`<!doctype html><html><head><title>Credit Sale Register</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:6px;font-size:11px}th{background:#eee}</style></head><body><h1>SATAT FILLING STATION</h1><h2>Credit Sale Register</h2><table><thead><tr><th>Date</th><th>Parchi No</th><th>Party</th><th>Vehicle</th><th>Fuel</th><th>Product</th><th>Qty</th><th>Rate (GST Incl.)</th><th>Amount (GST Incl.)</th></tr></thead><tbody>${body}</tbody></table></body></html>`); w.document.close();
  }

  function printLubricantSaleBill(c) {
    if (!c || c.fuel !== "LUBRICANT") {
      alert("यह Sale Bill केवल Lubricant / Mobile Oil के लिए है।");
      return;
    }
    const escHtml = v => String(v ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[ch]));
    const total = rupee(n(c.amount));
    const lubricantInvoiceBuild = "paise-v3"; // Lubricant invoice only; forces a fresh browser bundle.
    const product = c.productName || "Mobile Oil (HPCL)";
    const qtyMatch = String(product).match(/([0-9]+(?:[.][0-9]+)?)\s*(?:ltr|litre|liter|l)\s*x\s*([0-9]+(?:[.][0-9]+)?)/i);
    const parsedQty = qtyMatch ? n(qtyMatch[1]) * n(qtyMatch[2]) : 0;
    const qty = n(c.qty) > 0 ? n(c.qty) : parsedQty;
    const gstRate = n(c.gstRate) > 0 ? n(c.gstRate) : 18;
    // Always treat the saved amount as the final/gross invoice value.
    // GST-inclusive invoice: CGST and SGST must be equal on the bill.
    // Calculate one half of GST to paise, then derive taxable value from
    // the final displayed GST so the invoice total reconciles exactly.
    // Example ₹6,000 @ 18% => Taxable ₹5,084.74, CGST ₹457.63,
    // Production cache-refresh marker: invoice GST display uses the paise-precise equal split.
    // SGST ₹457.63, Grand Total ₹6,000.00.
    const round2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
    // Lubricant invoice only: never round GST lines to whole rupees.
    // Keep CGST/SGST/taxable values at exactly 2 paise decimals.
    const invoiceMoney = v => {
      const amount = Number(v ?? 0);
      return "₹" + amount.toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
    };
    const halfGst = gstRate > 0 ? round2(total * gstRate / (2 * (100 + gstRate))) : 0;
    const cgst = gstRate > 0 ? halfGst : 0;
    const sgst = gstRate > 0 ? halfGst : 0;
    const tax = round2(cgst + sgst);
    const taxable = round2(total - tax);
    const rate = qty > 0 ? round2(total / qty) : 0;
    const unitRate = qty > 0 ? rate : 0;
    const amountInWords = (() => {
      const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
      const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
      const two = n => n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
      const under1000 = n => {
        const h = Math.floor(n/100), r = n%100;
        return (h ? ones[h] + " Hundred" : "") + (h && r ? " " : "") + (r ? two(r) : "");
      };
      let x = Math.round(total);
      if (x === 0) return "Zero Rupees Only";
      const parts = [];
      const crore = Math.floor(x/10000000); x %= 10000000;
      const lakh = Math.floor(x/100000); x %= 100000;
      const thousand = Math.floor(x/1000); x %= 1000;
      if (crore) parts.push(under1000(crore) + " Crore");
      if (lakh) parts.push(under1000(lakh) + " Lakh");
      if (thousand) parts.push(under1000(thousand) + " Thousand");
      if (x) parts.push(under1000(x));
      return parts.join(" ") + " Rupees Only";
    })();

    const invoiceNo = String(c.invoiceNo || "").trim();
    const challanNo = String(c.parchiNo || "").trim();
    // Render the invoice directly in the app. No popup, no about:blank, no iframe.
    const showInvoice = html => {
      const old = document.getElementById("stationmitra-lubricant-sale-viewer");
      if (old) old.remove();

      const overlay = document.createElement("div");
      overlay.id = "stationmitra-lubricant-sale-viewer";
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:auto;padding:12px;box-sizing:border-box";

      const parsed = new DOMParser().parseFromString(html, "text/html");
      const toolbar = document.createElement("div");
      toolbar.className = "sm-bill-toolbar";
      toolbar.style.cssText = "position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;padding:6px 0 10px;background:#fff";

      const printBtn = document.createElement("button");
      printBtn.type = "button";
      printBtn.textContent = "🖨️ Print / Save PDF";
      printBtn.style.cssText = "padding:9px 16px;border:0;border-radius:6px;background:#111;color:#fff;font-weight:700;cursor:pointer";

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "✕ Close Bill";
      closeBtn.style.cssText = "padding:9px 16px;border:0;border-radius:6px;background:#666;color:#fff;font-weight:700;cursor:pointer";

      toolbar.appendChild(printBtn);
      toolbar.appendChild(closeBtn);
      overlay.appendChild(toolbar);

      const paper = document.createElement("div");
      paper.className = "sm-bill-paper";
      paper.innerHTML = parsed.body.innerHTML;
      overlay.appendChild(paper);
      document.body.appendChild(overlay);

      closeBtn.onclick = () => overlay.remove();
      printBtn.onclick = () => {
        const style = document.createElement("style");
        style.id = "stationmitra-bill-print-style";
        style.textContent = `
          @media print {
            body > *:not(#stationmitra-lubricant-sale-viewer) { display:none !important; }
            #stationmitra-lubricant-sale-viewer { position:static !important; padding:0 !important; overflow:visible !important; }
            #stationmitra-lubricant-sale-viewer .sm-bill-toolbar { display:none !important; }
            #stationmitra-lubricant-sale-viewer .sm-bill-paper { max-width:none !important; }
            @page { size:A4 portrait; margin:10mm; }
          }
        `;
        document.head.appendChild(style);
        window.print();
        setTimeout(() => style.remove(), 1000);
      };
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ${escHtml(invoiceNo)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:10mm;color:#111;font-size:11px;background:#fff}
      .invoice{border:1px solid #111;max-width:850px;margin:auto;background:#fff}.head{text-align:center;border-bottom:1px solid #111;padding:9px 12px 7px}
      .head .om{font-size:13px;font-weight:700}.head h1{font-size:21px;margin:3px 0}.head .dealer{font-size:11px;font-weight:700}.head .addr{font-size:10px;margin-top:3px}
      .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #111}.meta>div{padding:7px 9px;min-height:72px;line-height:1.45}.meta>div+div{border-left:1px solid #111}
      table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #111;padding:5px 4px;font-size:10px;vertical-align:middle}th{text-align:center;font-weight:700;background:#f3f4f6}td.num{text-align:right;white-space:nowrap}.items td{height:38px;word-break:break-word}.items th:nth-child(1),.items td:nth-child(1){width:10%}.items th:nth-child(2),.items td:nth-child(2){width:9%}.items th:nth-child(3),.items td:nth-child(3){width:10%}.items th:nth-child(4),.items td:nth-child(4){width:8%}.items th:nth-child(5),.items td:nth-child(5){width:28%}.items th:nth-child(6),.items td:nth-child(6){width:9%}.items th:nth-child(7),.items td:nth-child(7){width:12%}.items th:nth-child(8),.items td:nth-child(8){width:14%}
      .bottom{display:grid;grid-template-columns:1.25fr 1fr;border-top:1px solid #111}.bottom>div{padding:8px 9px;min-height:125px;line-height:1.6}.bottom>div+div{border-left:1px solid #111}
      .terms{padding:7px 9px;border-top:1px solid #111;font-size:9px;line-height:1.45}.sign{text-align:right;margin-top:18px;font-weight:700}
      .printbar{text-align:right;margin-bottom:8px}.printbtn{padding:7px 12px;border:1px solid #555;border-radius:6px;background:#eee;cursor:pointer}
      @media print{.printbar{display:none}@page{size:A4 portrait;margin:8mm}body{padding:0}.invoice{max-width:none}}
    </style></head><body>
    <div class="printbar"><button class="printbtn" onclick="window.focus();window.print()">🖨️ Print / Save PDF</button></div>
    <div class="invoice">
      <div class="head"><div class="om">ॐ श्री गुरुवे नमः:</div><div><b>GSTIN: 05ABWFS5610D1Z4</b> &nbsp; | &nbsp; State Code: 05</div><h1>SATAT FILLING STATION</h1><div class="dealer">DEALER - HINDUSTAN PETROLEUM CORP. LTD.</div><div class="addr">Bye Pass Gaujajali (Bichli), HALDWANI-263139, Distt. Nainital (Uttarakhand)</div></div>
      <div class="meta"><div><b>Bill To:</b><br>${escHtml(c.party)}<br>${c.vehicle ? "Vehicle No.: "+escHtml(c.vehicle) : ""}</div><div><b>Tax Invoice</b><br><b>Invoice No.:</b> ${escHtml(invoiceNo || "—")}<br><b>Challan No.:</b> ${escHtml(challanNo || "—")}<br><b>Date:</b> ${escHtml(c.date)}<br><b>Payment:</b> CREDIT / UDHARI</div></div>
      <table class="items"><thead><tr><th>Date</th><th>Challan</th><th>Vehicle</th><th>HSN</th><th>Product / Description</th><th>Qty (L)</th><th>Rate / L</th><th>Amount</th></tr></thead>
      <tbody><tr><td>${escHtml(c.date || "—")}</td><td>${escHtml(c.parchiNo || "—")}</td><td>${escHtml(c.vehicle || "—")}</td><td>${escHtml(c.hsnCode || "—")}</td><td><b>${escHtml(product)}</b></td><td class="num">${qty ? qty.toFixed(2) : "—"}</td><td class="num">${unitRate ? money(unitRate) : "—"}</td><td class="num"><b>${money(total)}</b></td></tr></tbody></table>
      <div class="bottom"><div><b>Rupees in Words:</b><br>${escHtml(amountInWords)}</div><div><div>Taxable Value: <b style="float:right">${invoiceMoney(taxable)}</b></div><div>Add: CGST (9%): <b style="float:right">${invoiceMoney(cgst)}</b></div><div>Add: SGST (9%): <b style="float:right">${invoiceMoney(sgst)}</b></div><div>Add: IGST: <b style="float:right">${invoiceMoney(0)}</b></div><div>Tax Amount - GST: <b style="float:right">${invoiceMoney(tax)}</b></div><hr><div><b>Total Amount After Tax:</b><b style="float:right">${invoiceMoney(total)}</b></div></div></div>
      <div class="terms"><b>TERMS &amp; CONDITIONS :-</b><br>• Once Goods Sold will not be taken back.<br>• All Jurisdiction Disputes will be settled at Haldwani Court.<br>• Interest 2% will be charged on all bills if not paid within 15 days.<div class="sign">For - SATAT FILLING STATION<br><br>Authorized Signatory</div></div>
    </div></body></html>`;
    try {
      showInvoice(html);
    } catch (e) {
      console.error("Sale Bill render error:", e);
      alert("Sale Bill नहीं खुल पाया: " + (e?.message || e));
    }
  }

  function shareCreditWhatsApp() {
    const total=data.credits.reduce((a,c)=>a+n(c.amount),0);
    const msg=`*SATAT FILLING STATION*\n*Credit Sale Register*\nEntries: ${data.credits.length}\nOutstanding Credit: ${money(total)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`,"_blank");
  }

  return (
    <div className="content">

      <section className="panel">

        <h2>
          Credit Sale
        </h2>

        <p>
          <b>
            Parchi No. Manual रहेगा.
          </b>
          {" "}
          System automatic number नहीं लगाएगा.
        </p>

        <div className="form">

          <Field label="Date">

            <input
              type="date"
              min={START_DATE}
              value={f.date}
              onChange={e =>
                setF({
                  ...f,
                  date:e.target.value
                })
              }
            />

          </Field>

          <Field label="Challan No. (Manual)">

            <input
              value={f.parchiNo}
              onChange={e =>
                setF({
                  ...f,
                  parchiNo:
                    e.target.value
                })
              }
            />

          </Field>

          {f.fuel === "LUBRICANT" && (
            <Field label="Invoice No. (Manual)">
              <input
                value={f.invoiceNo}
                onChange={e => setF({ ...f, invoiceNo: e.target.value })}
                placeholder="Invoice No. डालें"
              />
            </Field>
          )}

          <Field label="Party">

            <select
              value={f.party}
              onChange={e =>
                setF({
                  ...f,
                  party:e.target.value
                })
              }
            >

              <option value="">
                Select
              </option>

              {data.parties.map(
                p => (
                  <option
                    key={p.id}
                  >
                    {p.name}
                  </option>
                )
              )}

            </select>

          </Field>

          <Field label="Vehicle">

            <input
              value={f.vehicle}
              onChange={e =>
                setF({
                  ...f,
                  vehicle:
                    e.target.value
                      .toUpperCase()
                })
              }
            />

          </Field>

          <Field label="Fuel">

            <select
              value={f.fuel}
              onChange={e =>
                setF({
                  ...f,
                  fuel:e.target.value,
                  productName: e.target.value === "LUBRICANT" ? (f.productName || "Mobile Oil (HPCL)") : "",
                  manualAmount: e.target.value === "LUBRICANT" ? f.manualAmount : ""
                })
              }
            >
              <option>MS</option>
              <option>HSD</option>
              <option>CNG</option>
              <option value="LUBRICANT">Lubricant / Mobile Oil</option>
            </select>

          </Field>

          {f.fuel === "LUBRICANT" && (
            <Field label="Product (Uploaded Bill से Select करें)">
              <select value={f.productName} onChange={e => {const productName=e.target.value;const inferred=inferLubricantPackSizeLitres(productName);setF(x=>({...x,productName,packSize:inferred||x.packSize,qty:n(x.packQty)>0&&inferred>0?rupee(n(x.packQty)*inferred):x.qty}));}}>
                <option value="">Select Product</option>
                {f.productName && !lubricantProductOptions.some(x => x.name === f.productName) && <option value={f.productName}>{f.productName}</option>}
                {lubricantProductOptions.map((x, i) => <option key={x.name + i} value={x.name}>{x.name}{x.hsn ? " · HSN " + x.hsn : ""}{x.invoiceNo ? " · Inv " + x.invoiceNo : ""}</option>)}
              </select>
              <small style={{display:"block",marginTop:4,color:"#64748b"}}>HPCL upload किए गए purchase bill के item products यहाँ से चुनें।</small>
            </Field>
          )}

          {f.fuel === "LUBRICANT" && <><Field label="Pack/Balti Qty"><input type="number" min="0" step="1" value={f.packQty} onChange={e=>setF({...f,packQty:e.target.value,qty:n(e.target.value)>0&&n(f.packSize)>0?rupee(n(e.target.value)*n(f.packSize)):""})}/></Field><Field label="Pack Size (L)"><input type="number" min="0" step="0.01" value={f.packSize} onChange={e=>setF({...f,packSize:e.target.value,qty:n(f.packQty)>0&&n(e.target.value)>0?rupee(n(f.packQty)*n(e.target.value)):f.qty})} placeholder="जैसे 10"/></Field></>}
          <Field label={f.fuel === "LUBRICANT" ? "Total Qty (Litre)" : "Qty"}>
            <input type="number" step={f.fuel === "CNG" ? ".001" : ".01"} value={f.qty} onChange={e=>setF({...f,qty:e.target.value})}/>
          </Field>

          <Field label={f.fuel === "LUBRICANT" ? "Bill Amount (GST सहित)" : "Amount"}>

            <input
              className={f.fuel === "LUBRICANT" ? "" : "readonly"}
              type="number"
              step="0.01"
              readOnly={f.fuel !== "LUBRICANT"}
              value={f.fuel === "LUBRICANT" ? f.manualAmount : String(amount)}
              onChange={e => f.fuel === "LUBRICANT" && setF({ ...f, manualAmount: e.target.value })}
              placeholder={f.fuel === "LUBRICANT" ? "6000 (GST सहित)" : ""}
            />

          </Field>

        </div>

        <div className="actions">

          <button className="btn" onClick={save}>
            {editId !== null ? "✏️ Update Credit" : "Save Credit"}
          </button>

          {editId !== null && (
            <button type="button" className="btn gray" onClick={() => {
              setEditId(null);
              setF({ date: todayDate(), parchiNo: "", invoiceNo: "", party: "", vehicle: "", fuel: "MS", productName: "", qty: "", manualAmount: "" });
              setMsg("");
            }}>
              Cancel Edit
            </button>
          )}

        </div>

        {msg && (
          <div className="notice">
            {msg}
          </div>
        )}

      </section>

      <section className="panel" style={{marginTop:18}}>
        <div className="actions" style={{marginTop:0}}>
          <button type="button" className="btn" onClick={printCreditPdf}>🖨️ Print / PDF</button>
          <button type="button" className="btn" onClick={exportCreditExcel}>📊 Excel</button>
          <button type="button" className="btn" onClick={shareCreditWhatsApp}>💬 WhatsApp</button>
        </div>
      </section>

     <section
        className="panel"
        style={{
          marginTop: 18
        }}
      >

        <h2>
          Credit Register
        </h2>

       <Table
  headers={[
    "Date",
    "Parchi No",
    "Party",
    "Vehicle",
    "Fuel",
    "Product",
    "Qty",
    "Amount"
  ]}

  rows={
    data.credits
      .slice()
      .reverse()
      .map(c => [
        c.date,
        c.parchiNo,
        c.party,
        c.vehicle,
        c.fuel,
        c.productName || "—",
        c.qty,
        moneyRupee(c.amount)
      ])
  }

  onEdit={(id) => {
    const c = data.credits.find(x => x.id === id);
    if (!c) return;
    setEditId(c.id);
    setF({
      date: c.date || todayDate(),
      parchiNo: String(c.parchiNo ?? ""),
      invoiceNo: String(c.invoiceNo ?? ""),
      party: c.party ?? "",
      vehicle: c.vehicle ?? "",
      fuel: c.fuel ?? "MS",
      productName: c.productName ?? "",
      qty: String(c.qty ?? ""),
      // Edit using the final/gross invoice amount so GST is re-derived correctly.
      manualAmount: String(c.fuel === "LUBRICANT" ? n(c.amount) : "")
    });
    setMsg("Credit Sale edit mode में है.");
  }}

  onPrintBill={(id) => {
    const c = data.credits.find(x => x.id === id);
    if (c?.fuel === "LUBRICANT") printLubricantSaleBill(c);
  }}

  showPrintBill={(id) => data.credits.some(x => x.id === id && x.fuel === "LUBRICANT")}

  onDelete={(id) => {
    const c = data.credits.find(x => x.id === id);
    if (!c) return;
    if (!window.confirm("क्या आप Credit Sale " + String(c.parchiNo || "") + " को delete करना चाहते हैं?")) return;
    update({ credits: data.credits.filter(x => x.id !== id) });
    if (editId === id) {
      setEditId(null);
      setF({ date: todayDate(), parchiNo: "", party: "", vehicle: "", fuel: "MS", productName: "", qty: "", manualAmount: "" });
    }
    setMsg("Credit Sale Delete हो गई.");
  }}

  rowIds={
    data.credits
      .slice()
      .reverse()
      .map(c => c.id)
  }
/>

      </section>
    </div>
  );
}



/* =========================================================
   PARTY LEDGER
========================================================= */

function isRecoveryCreditRow(row) {
  return /-RECOVERY-/i.test(String(row?.transactionId || ""));
}

// Party Ledger must show the authoritative accounting row, not the recovery
// representations created by backup conflict repair. If an original row
// exists for a transaction family, recovery rows are excluded. Exact duplicate
// business rows are also collapsed so the same real sale cannot debit the
// party twice under different transaction IDs.
function ledgerCreditRows(credits) {
  const source = Array.isArray(credits) ? credits : [];
  const families = new Map();

  source.forEach((row, index) => {
    const transactionId = String(row?.transactionId || row?.id || `credit-${index}`);
    const familyId = transactionId.split(/-RECOVERY-/i)[0];
    if (!families.has(familyId)) families.set(familyId, []);
    families.get(familyId).push(row);
  });

  const familySelected = [];
  families.forEach(rows => {
    const originals = rows.filter(row => !isRecoveryCreditRow(row));
    // A recovery-only family is retained once so a genuinely recovered sale
    // is not lost. When the original exists, recovery representations do not
    // create another Udhari Sale debit.
    familySelected.push(...(originals.length ? originals : [rows[0]]));
  });

  const seenBusinessKeys = new Set();
  return familySelected.filter(row => {
    const businessKey = [
      row?.date,
      row?.party,
      row?.parchiNo,
      row?.vehicle,
      row?.fuel,
      row?.qty,
      rupee(row?.amount)
    ].map(v => String(v ?? "").trim().toUpperCase()).join("|");

    if (seenBusinessKeys.has(businessKey)) return false;
    seenBusinessKeys.add(businessKey);
    return true;
  });
}

export function PartyLedger({ data, setPage, update }) {
  const [party, setParty] = useState("");
  const [from, setFrom] = useState(START_DATE);
  const [to, setTo] = useState("");
  const [openingInput, setOpeningInput] = useState("");
  const [openingType, setOpeningType] = useState("DEBIT");
  const [openingDate, setOpeningDate] = useState(START_DATE);

  const [payment, setPayment] = useState({
    date: todayDate(),
    amount: "",
    mode: "Cash",
    note: ""
  });

  const [msg, setMsg] = useState("");

  const parties = useMemo(() => {
    const names = new Set();

    (data.parties || []).forEach(p => {
      if (p?.name) names.add(String(p.name));
    });

    (data.credits || []).forEach(c => {
      if (c?.party) names.add(String(c.party));
    });

    (data.ledgerOpenings || []).forEach(o => {
      if (o?.party) names.add(String(o.party));
    });

    (data.ledgerPayments || []).forEach(p => {
      if (p?.party) names.add(String(p.party));
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data.parties, data.credits, data.ledgerOpenings, data.ledgerPayments]);

  const openings = useMemo(
    () => Array.isArray(data.ledgerOpenings) ? data.ledgerOpenings : [],
    [data.ledgerOpenings]
  );

  const payments = useMemo(
    () => Array.isArray(data.ledgerPayments) ? data.ledgerPayments : [],
    [data.ledgerPayments]
  );

  const selectedOpening = useMemo(() => {
    if (!party) return null;
    return openings.find(o => o.party === party) || null;
  }, [openings, party]);

  useEffect(() => {
    if (selectedOpening) {
      setOpeningInput(String(n(selectedOpening.amount)));
      setOpeningType(selectedOpening.type || "DEBIT");
      setOpeningDate(selectedOpening.date || START_DATE);
    } else {
      setOpeningInput("");
      setOpeningType("DEBIT");
      setOpeningDate(START_DATE);
    }

    setPayment(prev => ({
      ...prev,
      date: prev.date || todayDate(),
      amount: "",
      note: ""
    }));
    setMsg("");
  }, [party, selectedOpening]);

  function inDateRange(date) {
    const d = String(date || "");
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function openingSigned(opening) {
    if (!opening) return 0;
    const amount = rupee(opening.amount);
    return opening.type === "CREDIT" ? -amount : amount;
  }

  function saveOpeningOutstanding() {
    setMsg("");

    if (!party) {
      setMsg("पहले Party Select करें.");
      return;
    }

    const amount = rupee(openingInput);

    if (amount < 0) {
      setMsg("Opening Outstanding negative नहीं हो सकता.");
      return;
    }

    const openingDateError = assertPeriodDate(openingDate, "Opening Date");
    if (openingDateError) {
      setMsg(openingDateError);
      return;
    }

    const oldOpenings = Array.isArray(data.ledgerOpenings)
      ? data.ledgerOpenings
      : [];

    const existing = oldOpenings.find(o => o.party === party);

    const record = {
      id: existing?.id || Date.now(),
      party,
      date: openingDate,
      type: openingType,
      amount
    };

    update({
      ledgerOpenings: [
        ...oldOpenings.filter(o => o.party !== party),
        record
      ]
    });

    setMsg(
      `${party} का Opening Outstanding ${moneyRupee(amount)} (${openingType === "CREDIT" ? "Credit" : "Debit"}) के रूप में ${openingDate} को Save हो गया.`
    );
  }

  function savePayment() {
    setMsg("");

    if (!party) {
      setMsg("पहले Party Select करें.");
      return;
    }

    const amount = rupee(payment.amount);

    if (amount <= 0) {
      setMsg("Payment Receiving amount डालें.");
      return;
    }

    const paymentDateError = assertPeriodDate(payment.date, "Payment Date");
    if (paymentDateError) {
      setMsg(paymentDateError);
      return;
    }

    const oldPayments = Array.isArray(data.ledgerPayments)
      ? data.ledgerPayments
      : [];

    const record = {
      id: Date.now(),
      date: payment.date,
      party,
      amount,
      mode: payment.mode,
      note: payment.note || ""
    };

    update({
      ledgerPayments: [...oldPayments, record]
    });

    setPayment(prev => ({
      ...prev,
      amount: "",
      note: ""
    }));

    setMsg(`${party} की Payment Receiving ${moneyRupee(amount)} Save हो गई.`);
  }

  const openingAmount = selectedOpening ? n(selectedOpening.amount) : 0;
  const openingDebit = selectedOpening?.type === "CREDIT" ? 0 : openingAmount;
  const openingCredit = selectedOpening?.type === "CREDIT" ? openingAmount : 0;

  const entries = useMemo(() => {
    if (!party) return [];

    const out = [];

    if (selectedOpening) {
      out.push({
        id: `opening-${selectedOpening.id}`,
        date: selectedOpening.date || START_DATE,
        type: selectedOpening.type === "CREDIT" ? "Opening Credit" : "Opening Debit",
        parchiNo: "",
        vehicle: "",
        fuel: "",
        qty: 0,
        debit: openingDebit,
        credit: openingCredit,
        note: "Opening Outstanding"
      });
    }

    ledgerCreditRows(data.credits)
      .filter(c => c.party === party && inDateRange(c.date))
      .forEach(c => {
        out.push({
          id: `sale-${c.id}`,
          date: c.date,
          type: "Udhari Sale",
          parchiNo: c.parchiNo || "",
          vehicle: c.vehicle || "",
          fuel: c.fuel || "",
          qty: n(c.qty),
          debit: n(c.amount),
          credit: 0,
          note: "Credit Sale"
        });
      });

    payments
      .filter(p => p.party === party && inDateRange(p.date))
      .forEach(p => {
        out.push({
          id: `payment-${p.id}`,
          date: p.date,
          type: "Payment Received",
          parchiNo: "",
          vehicle: "",
          fuel: "",
          qty: 0,
          debit: 0,
          credit: n(p.amount),
          note: `${p.mode || ""}${p.note ? " - " + p.note : ""}`
        });
      });

    out.sort((a, b) => {
      const d = String(a.date || "").localeCompare(String(b.date || ""));
      return d || String(a.id).localeCompare(String(b.id));
    });

    return out;
  }, [
    party,
    selectedOpening,
    data.credits,
    payments,
    from,
    to,
    openingDebit,
    openingCredit
  ]);

  const openingOutstanding = party ? openingSigned(selectedOpening) : 0;

  const salesTotal = entries
    .filter(e => e.type === "Udhari Sale")
    .reduce((sum, e) => sum + rupee(e.debit), 0);

  const receiptsTotal = entries
    .filter(e => e.type === "Payment Received")
    .reduce((sum, e) => sum + rupee(e.credit), 0);

  const currentOutstanding =
    openingOutstanding + salesTotal - receiptsTotal;

  const qty = entries.reduce((sum, e) => sum + n(e.qty), 0);

  /* =========================================================
     ALL PARTY OUTSTANDING SUMMARY
     ========================================================= */
  const allPartySummary = useMemo(() => {
    return parties.map(name => {
      const opening = openings.find(o => o.party === name) || null;
      const openingValue = openingSigned(opening);

      const sales = ledgerCreditRows(data.credits)
        .filter(c => c.party === name && inDateRange(c.date))
        .reduce((sum, c) => sum + rupee(c.amount), 0);

      const received = payments
        .filter(p => p.party === name && inDateRange(p.date))
        .reduce((sum, p) => sum + rupee(p.amount), 0);

      const outstanding = rupee(
        openingValue + sales - received
      );

      return {
        party: name,
        opening: rupee(openingValue),
        sales: rupee(sales),
        received: rupee(received),
        outstanding
      };
    });
  }, [
    parties,
    openings,
    data.credits,
    payments,
    from,
    to
  ]);

  const outstandingPartySummary = useMemo(
    () => allPartySummary.filter(row => Math.abs(rupee(row.outstanding)) > 0),
    [allPartySummary]
  );

  const allTotals = useMemo(() => {
    return outstandingPartySummary.reduce(
      (t, row) => ({
        opening: t.opening + row.opening,
        sales: t.sales + row.sales,
        received: t.received + row.received,
        outstanding: t.outstanding + row.outstanding
      }),
      { opening: 0, sales: 0, received: 0, outstanding: 0 }
    );
  }, [outstandingPartySummary]);

  function exportAllPartyExcel() {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const lines = [
      ["SATAT FILLING STATION"],
      ["ALL PARTY OUTSTANDING", from || "", to || ""],
      ["Opening Outstanding", allTotals.opening],
      ["Udhari Sale", allTotals.sales],
      ["Payment Received", allTotals.received],
      ["Current Outstanding", allTotals.outstanding],
      ["Party", "Opening Outstanding", "Udhari Sale", "Payment Received", "Current Outstanding"]
    ].map(r => r.map(esc).join(","));

    outstandingPartySummary.forEach(row => {
      lines.push([
        row.party,
        row.opening,
        row.sales,
        row.received,
        row.outstanding
      ].map(esc).join(","));
    });

    lines.push([
      "TOTAL",
      allTotals.opening,
      allTotals.sales,
      allTotals.received,
      allTotals.outstanding
    ].map(esc).join(","));

    const blob = new Blob(
      ["\uFEFF" + lines.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `All_Party_Outstanding_${todayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printAllPartyPdf() {
    const rows = outstandingPartySummary.map(row => `
      <tr>
        <td>${row.party}</td>
        <td>${moneyRupee(row.opening)}</td>
        <td>${moneyRupee(row.sales)}</td>
        <td>${moneyRupee(row.received)}</td>
        <td><b>${moneyRupee(row.outstanding)}</b></td>
      </tr>
    `).join("");

    const w = window.open("", "_blank");
    if (!w) {
      alert("Print window blocked है. Browser में pop-up allow करें.");
      return;
    }

    w.document.write(`<!doctype html>
<html>
<head>
<title>All Party Outstanding</title>
<style>
body{font-family:Arial;margin:20px;color:#111}
h1{margin-bottom:4px}
p{margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:18px}
th,td{border:1px solid #555;padding:7px;font-size:12px;text-align:right}
th:first-child,td:first-child{text-align:left}
th{background:#eee}
.cards{display:flex;gap:10px;flex-wrap:wrap;margin:15px 0}
.box{border:1px solid #aaa;padding:10px;min-width:150px}
.total{font-weight:bold}
</style>
</head>
<body>
<h1>SATAT FILLING STATION</h1>
<h2>All Party Outstanding</h2>
<p>From: ${from || "—"} &nbsp; To: ${to || "—"}</p>
<div class="cards">
  <div class="box">Opening: <b>${moneyRupee(allTotals.opening)}</b></div>
  <div class="box">Udhari Sale: <b>${moneyRupee(allTotals.sales)}</b></div>
  <div class="box">Received: <b>${moneyRupee(allTotals.received)}</b></div>
  <div class="box">Outstanding: <b>${moneyRupee(allTotals.outstanding)}</b></div>
</div>
<table>
<thead>
<tr><th>Party</th><th>Opening</th><th>Udhari Sale</th><th>Payment Received</th><th>Current Outstanding</th></tr>
</thead>
<tbody>${rows}
<tr class="total">
<td>TOTAL</td>
<td>${moneyRupee(allTotals.opening)}</td>
<td>${moneyRupee(allTotals.sales)}</td>
<td>${moneyRupee(allTotals.received)}</td>
<td>${moneyRupee(allTotals.outstanding)}</td>
</tr>
</tbody>
</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
</body>
</html>`);
    w.document.close();
  }

  function shareAllPartyWhatsApp() {
    const msg =
      `*SATAT FILLING STATION*\n` +
      `*ALL PARTY OUTSTANDING*\n` +
      `From: ${from || "—"} To: ${to || "—"}\n` +
      `Opening Outstanding: ${moneyRupee(allTotals.opening)}\n` +
      `Udhari Sale: ${moneyRupee(allTotals.sales)}\n` +
      `Payment Received: ${moneyRupee(allTotals.received)}\n` +
      `Current Outstanding: ${moneyRupee(allTotals.outstanding)}\n\n` +
      outstandingPartySummary
        .map(r => `${r.party}: ${moneyRupee(r.outstanding)}`)
        .join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  function exportLedgerExcel() {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const lines = [
      ["SATAT FILLING STATION"],
      ["Party Ledger", party || "All Parties", from || "", to || ""],
      ["Opening Date", selectedOpening?.date || openingDate || START_DATE],
      ["Opening Type", selectedOpening?.type || openingType],
      ["Opening Outstanding", openingOutstanding],
      ["Udhari Sale", salesTotal],
      ["Payment Received", receiptsTotal],
      ["Current Outstanding", currentOutstanding],
      [
        "Date", "Type", "Parchi No", "Party", "Vehicle", "Fuel", "Qty",
        "Opening Outstanding", "Debit", "Credit", "Balance", "Note"
      ]
    ].map(r => r.map(esc).join(","));

    let running = 0;

    entries.forEach(e => {
      running += n(e.debit) - n(e.credit);
      lines.push([
        e.date,
        e.type,
        e.parchiNo,
        party,
        e.vehicle,
        e.fuel,
        n(e.qty),
        e.type === "Opening Credit" || e.type === "Opening Debit" ? openingOutstanding : "",
        n(e.debit),
        n(e.credit),
        running,
        e.note
      ].map(esc).join(","));
    });

    const blob = new Blob(
      ["\uFEFF" + lines.join("\n")],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Party_Ledger_${party || "All"}_${todayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printLedgerPdf() {
    let running = 0;

    const body = entries.map(e => {
      running += n(e.debit) - n(e.credit);

      return `<tr>
        <td>${e.date || ""}</td>
        <td>${e.type || ""}</td>
        <td>${e.parchiNo || ""}</td>
        <td>${e.vehicle || ""}</td>
        <td>${e.fuel || ""}</td>
        <td>${n(e.qty).toFixed(e.fuel === "CNG" ? 3 : 2)}</td>
        <td>${e.type === "Opening Credit" || e.type === "Opening Debit" ? moneyRupee(openingOutstanding) : ""}</td>
        <td>${moneyRupee(e.debit)}</td>
        <td>${moneyRupee(e.credit)}</td>
        <td>${moneyRupee(running)}</td>
        <td>${e.note || ""}</td>
      </tr>`;
    }).join("");

    const w = window.open("", "_blank");
    if (!w) {
      alert("Print window blocked है. Browser में pop-up allow करें.");
      return;
    }

    w.document.write(`<!doctype html>
<html><head><title>Party Ledger</title>
<style>
body{font-family:Arial;margin:20px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #555;padding:6px;font-size:11px}
th{background:#eee}
.cards{display:flex;gap:20px;margin:15px 0;flex-wrap:wrap}
.box{border:1px solid #aaa;padding:10px}
</style></head><body>
<h1>SATAT FILLING STATION</h1>
<h2>Party Ledger - ${party || "All Parties"}</h2>
<p>From: ${from || "—"} &nbsp; To: ${to || "—"}</p>
<div class="cards">
<div class="box">Opening Date: <b>${selectedOpening?.date || openingDate || START_DATE}</b></div>
<div class="box">Opening Outstanding: <b>${moneyRupee(openingOutstanding)}</b></div>
<div class="box">Udhari Sale: <b>${moneyRupee(salesTotal)}</b></div>
<div class="box">Payment Received: <b>${moneyRupee(receiptsTotal)}</b></div>
<div class="box">Current Outstanding: <b>${moneyRupee(currentOutstanding)}</b></div>
</div>
<table><thead><tr>
<th>Date</th><th>Type</th><th>Parchi No</th><th>Vehicle</th><th>Fuel</th><th>Qty</th>
<th>Opening Outstanding</th><th>Debit</th><th>Credit</th><th>Balance</th><th>Note</th>
</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
</body></html>`);
    w.document.close();
  }

  function shareLedgerWhatsApp() {
    const msg =
      `*SATAT FILLING STATION*\n` +
      `*Party Ledger: ${party || "All Parties"}*\n` +
      `Opening Date: ${selectedOpening?.date || openingDate || START_DATE}\n` +
      `Opening Outstanding: ${moneyRupee(openingOutstanding)}\n` +
      `Udhari Sale: ${moneyRupee(salesTotal)}\n` +
      `Payment Received: ${moneyRupee(receiptsTotal)}\n` +
      `Current Outstanding: ${moneyRupee(currentOutstanding)}\n` +
      `From: ${from || "—"} To: ${to || "—"}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }

  /* =========================================================
     PARTY LEDGER EDIT / DELETE
     - Udhari Sale edits update the original Credit Sale record.
     - Payment edits update ledgerPayments.
     - Opening entry can be edited/deleted from this ledger.
  ========================================================= */
  function editLedgerEntry(e) {
    if (!e) return;

    if (e.type === "Udhari Sale") {
      const id = String(e.id).replace("sale-", "");
      const c = (data.credits || []).find(x => String(x.id) === id);
      if (!c) return;

      const nextDate = window.prompt("Date (YYYY-MM-DD)", c.date || todayDate());
      if (nextDate === null) return;
      const nextParchi = window.prompt("Parchi No.", String(c.parchiNo || ""));
      if (nextParchi === null) return;
      const nextVehicle = window.prompt("Vehicle", String(c.vehicle || ""));
      if (nextVehicle === null) return;
      const nextFuel = window.prompt("Fuel (MS / HSD / CNG)", String(c.fuel || "MS"));
      if (nextFuel === null) return;
      const fuel = String(nextFuel).trim().toUpperCase();
      if (!["MS", "HSD", "CNG"].includes(fuel)) {
        setMsg("Fuel केवल MS, HSD या CNG हो सकता है.");
        return;
      }
      const nextQty = window.prompt("Qty", String(c.qty ?? ""));
      if (nextQty === null) return;
      const qtyValue = n(nextQty);
      if (qtyValue <= 0) {
        setMsg("Qty 0 से अधिक होनी चाहिए.");
        return;
      }

      const rate = getRate(data, fuel, nextDate);
      const dateError = assertPeriodDate(nextDate, "Udhari Sale Date");
      if (dateError) { setMsg(dateError); return; }
      const amount = rupee(qtyValue * rate);

      update({
        credits: data.credits.map(x =>
          String(x.id) === id
            ? {
                ...x,
                date: nextDate,
                parchiNo: String(nextParchi),
                vehicle: String(nextVehicle).toUpperCase(),
                fuel,
                qty: qtyValue,
                amount
              }
            : x
        )
      });
      setMsg(`Udhari Sale ${nextParchi} update हो गई. Amount ${moneyRupee(amount)}.`);
      return;
    }

    if (e.type === "Payment Received") {
      const id = String(e.id).replace("payment-", "");
      const p = payments.find(x => String(x.id) === id);
      if (!p) return;

      const nextDate = window.prompt("Payment Date (YYYY-MM-DD)", p.date || todayDate());
      if (nextDate === null) return;
      const nextAmount = window.prompt("Payment Received ₹", String(p.amount ?? ""));
      if (nextAmount === null) return;
      const paymentDateError = assertPeriodDate(nextDate, "Payment Date");
      if (paymentDateError) { setMsg(paymentDateError); return; }
      const amount = rupee(nextAmount);
      if (amount <= 0) {
        setMsg("Payment amount 0 से अधिक होना चाहिए.");
        return;
      }
      const nextMode = window.prompt("Payment Mode (Cash / UPI / Bank Transfer / Cheque / Card / Other)", p.mode || "Cash");
      if (nextMode === null) return;
      const nextNote = window.prompt("Note", p.note || "");
      if (nextNote === null) return;

      update({
        ledgerPayments: payments.map(x =>
          String(x.id) === id
            ? { ...x, date: nextDate, amount, mode: nextMode, note: nextNote }
            : x
        )
      });
      setMsg(`Payment Receiving ${moneyRupee(amount)} update हो गई.`);
      return;
    }

    if (e.type === "Opening Credit" || e.type === "Opening Debit") {
      if (!selectedOpening) return;
      setOpeningInput(String(n(selectedOpening.amount)));
      setOpeningType(selectedOpening.type || "DEBIT");
      setOpeningDate(selectedOpening.date || START_DATE);
      setMsg("Opening Outstanding ऊपर Edit करने के लिए तैयार है. बदलाव करके Save Opening Outstanding दबाएँ.");
    }
  }

  function deleteLedgerEntry(e) {
    if (!e) return;

    if (e.type === "Udhari Sale") {
      const id = String(e.id).replace("sale-", "");
      const c = (data.credits || []).find(x => String(x.id) === id);
      if (!c) return;
      if (!window.confirm(`क्या आप Udhari Sale ${String(c.parchiNo || "")} को delete करना चाहते हैं?`)) return;
      update({ credits: data.credits.filter(x => String(x.id) !== id) });
      setMsg(`Udhari Sale ${String(c.parchiNo || "")} delete हो गई.`);
      return;
    }

    if (e.type === "Payment Received") {
      const id = String(e.id).replace("payment-", "");
      const p = payments.find(x => String(x.id) === id);
      if (!p) return;
      if (!window.confirm(`क्या आप ${moneyRupee(p.amount)} की Payment Receiving delete करना चाहते हैं?`)) return;
      update({ ledgerPayments: payments.filter(x => String(x.id) !== id) });
      setMsg(`Payment Receiving ${moneyRupee(p.amount)} delete हो गई.`);
      return;
    }

    if (e.type === "Opening Credit" || e.type === "Opening Debit") {
      if (!selectedOpening) return;
      if (!window.confirm(`क्या आप ${party} का Opening Outstanding ${moneyRupee(selectedOpening.amount)} delete करना चाहते हैं?`)) return;
      update({
        ledgerOpenings: openings.filter(x => x.id !== selectedOpening.id)
      });
      setMsg(`${party} का Opening Outstanding delete हो गया.`);
    }
  }

  return (
    <div className="content">
      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2>📒 Party Ledger</h2>
            <p>
              Opening Outstanding + Udhari Sale - Payment Received = Current Outstanding
            </p>
          </div>

          <button className="btn" onClick={() => setPage("Credit Sale")}>
            ➕ Credit Sale
          </button>
        </div>

        <div className="form" style={{ marginTop: 15 }}>
          <Field label="Party">
            <select value={party} onChange={e => setParty(e.target.value)}>
              <option value="">All Parties / Party Select करें</option>
              {parties.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>

          <Field label="From Date">
            <input
              type="date"
              value={from}
              min={START_DATE}
              onChange={e => setFrom(e.target.value)}
            />
          </Field>

          <Field label="To Date">
            <input
              type="date"
              value={to}
              min={START_DATE}
              onChange={e => setTo(e.target.value)}
            />
          </Field>
        </div>

        {/* =====================================================
            ALL PARTY VIEW
           ===================================================== */}
        {!party && (
          <>
            <section
              className="panel"
              style={{ marginTop: 18, border: "2px solid #3159a5" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap"
                }}
              >
                <div>
                  <h3>📊 All Party Outstanding</h3>
                  <p style={{ marginBottom: 0 }}>
                    सभी parties का Opening + Udhari Sale - Payment Received = Current Outstanding
                  </p>
                </div>

                <div className="actions">
                  <button type="button" className="btn" onClick={printAllPartyPdf}>
                    🖨️ Print / PDF
                  </button>
                  <button type="button" className="btn" onClick={exportAllPartyExcel}>
                    📊 Excel
                  </button>
                  <button type="button" className="btn" onClick={shareAllPartyWhatsApp}>
                    💬 WhatsApp
                  </button>
                </div>
              </div>

              <div className="cards" style={{ marginTop: 18, gridTemplateColumns: "repeat(2,1fr)" }}>
                <div className="card">
                  <span>Outstanding Parties</span>
                  <strong>{outstandingPartySummary.length}</strong>
                </div>
                <div className="card">
                  <span>Total Current Outstanding</span>
                  <strong>{moneyRupee(allTotals.outstanding)}</strong>
                </div>
              </div>

              <div className="table" style={{ marginTop: 18 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Sr.</th>
                      <th>Party Name</th>
                      <th>Current Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingPartySummary.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ textAlign: "center", padding: 20 }}>
                          अभी कोई Outstanding Party नहीं है.
                        </td>
                      </tr>
                    ) : (
                      outstandingPartySummary.map((row, index) => (
                        <tr
                          key={row.party}
                          onClick={() => setParty(row.party)}
                          style={{ cursor: "pointer" }}
                          title="Party Ledger खोलने के लिए click करें"
                        >
                          <td>{index + 1}</td>
                          <td><b>{row.party}</b></td>
                          <td><b>{moneyRupee(row.outstanding)}</b></td>
                        </tr>
                      ))
                    )}

                    {outstandingPartySummary.length > 0 && (
                      <tr>
                        <td colSpan="2"><b>TOTAL</b></td>
                        <td><b>{moneyRupee(allTotals.outstanding)}</b></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel" style={{ marginTop: 18 }}>
              <h3>ℹ️ कैसे काम करेगा?</h3>
              <p>
                किसी Party पर click करके उसका Opening Outstanding, Udhari Sale,
                Payment Receiving और पूरा Running Ledger देख सकते हैं.
              </p>
              <p style={{ marginBottom: 0 }}>
                <b>Current Outstanding = Opening + Udhari Sale - Payment Received</b>
              </p>
            </section>
          </>
        )}

        {/* =====================================================
            SELECTED PARTY VIEW
           ===================================================== */}
        {party && (
          <>
            <section
              className="panel"
              style={{ marginTop: 18, border: "2px solid #3159a5" }}
            >
              <h3>✏️ {party} — Opening Outstanding</h3>
              <p>
                {openingDate || START_DATE} को इस Party का पुराना Outstanding यहाँ डालकर Save करें.
              </p>

              <div className="form" style={{ marginTop: 10 }}>
                <Field label="Opening Date">
                  <input
                    type="date"
                    value={openingDate}
                    min={START_DATE}
                    onChange={e => setOpeningDate(e.target.value)}
                  />
                </Field>

                <Field label="Opening Outstanding ₹">
                  <input
                    type="number"
                    step=".01"
                    min="0"
                    value={openingInput}
                    placeholder="जैसे 25000"
                    onChange={e => setOpeningInput(e.target.value)}
                  />
                </Field>

                <Field label="Balance Type">
                  <select value={openingType} onChange={e => setOpeningType(e.target.value)}>
                    <option value="DEBIT">Debit — Party से लेना है</option>
                    <option value="CREDIT">Credit — Party का Advance</option>
                  </select>
                </Field>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={saveOpeningOutstanding}
                    style={{ width: "100%" }}
                  >
                    💾 Save Opening Outstanding
                  </button>
                </div>
              </div>
            </section>

            {party && !selectedOpening && (
              <section className="panel" style={{ marginTop: 18 }}>
                <h3>⚠️ Opening Outstanding अभी Save नहीं है</h3>
                <p style={{ marginBottom: 0 }}>
                  ऊपर Opening Outstanding डालकर <b>Save Opening Outstanding</b> दबाएँ.
                </p>
              </section>
            )}

            <section
              className="panel"
              style={{ marginTop: 18, border: "2px solid #2f7d4a" }}
            >
              <h3>💰 Payment Receiving</h3>
              <p>
                Party से payment मिलने पर यहाँ entry करें. Save होते ही Current Outstanding से घटेगी.
              </p>

              <div className="form" style={{ marginTop: 10 }}>
                <Field label="Payment Date">
                  <input
                    type="date"
                    value={payment.date}
                    min={START_DATE}
                    onChange={e => setPayment(prev => ({ ...prev, date: e.target.value }))}
                  />
                </Field>

                <Field label="Payment Received ₹">
                  <input
                    type="number"
                    step=".01"
                    min="0"
                    value={payment.amount}
                    placeholder="जैसे 10000"
                    onChange={e => setPayment(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </Field>

                <Field label="Payment Mode">
                  <select
                    value={payment.mode}
                    onChange={e => setPayment(prev => ({ ...prev, mode: e.target.value }))}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>

                <Field label="Note">
                  <input
                    type="text"
                    value={payment.note}
                    placeholder="जैसे 10/08/2026 का payment"
                    onChange={e => setPayment(prev => ({ ...prev, note: e.target.value }))}
                  />
                </Field>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={savePayment}
                    style={{ width: "100%", background: "#2f7d4a" }}
                  >
                    💰 Save Payment Receiving
                  </button>
                </div>
              </div>
            </section>

            {msg && (
              <div className="notice" style={{ marginTop: 12 }}>
                {msg}
              </div>
            )}

            <div className="actions" style={{ marginTop: 15 }}>
              <button type="button" className="btn" onClick={printLedgerPdf}>
                🖨️ Print / PDF
              </button>
              <button type="button" className="btn" onClick={exportLedgerExcel}>
                📊 Excel
              </button>
              <button type="button" className="btn" onClick={shareLedgerWhatsApp}>
                💬 WhatsApp
              </button>
              <button type="button" className="btn gray" onClick={() => setParty("")}>
                ↩️ All Parties
              </button>
            </div>

            <div className="cards" style={{ marginTop: 18 }}>
              <div className="card">
                <span>Opening Outstanding</span>
                <strong>{moneyRupee(openingOutstanding)}</strong>
              </div>
              <div className="card">
                <span>Udhari Sale</span>
                <strong>{moneyRupee(salesTotal)}</strong>
              </div>
              <div className="card">
                <span>Payment Received</span>
                <strong>{moneyRupee(receiptsTotal)}</strong>
              </div>
              <div className="card">
                <span>Current Outstanding</span>
                <strong>{moneyRupee(currentOutstanding)}</strong>
              </div>
              <div className="card">
                <span>Total Qty</span>
                <strong>{qty.toFixed(2)}</strong>
              </div>
            </div>

            <section className="panel" style={{ marginTop: 18 }}>
              <h3>{party} — Running Ledger</h3>
              <div className="table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Parchi No</th>
                      <th>Vehicle</th>
                      <th>Fuel</th>
                      <th>Qty</th>
                      <th>Opening Outstanding</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                      <th>Note</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td colSpan="12" style={{ textAlign: "center", padding: 20 }}>
                          कोई Ledger entry नहीं मिली.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let running = 0;
                        return entries.map(e => {
                          running += n(e.debit) - n(e.credit);
                          return (
                            <tr key={e.id}>
                              <td>{e.date}</td>
                              <td>{e.type}</td>
                              <td>{e.parchiNo}</td>
                              <td>{e.vehicle}</td>
                              <td>{e.fuel}</td>
                              <td>{n(e.qty).toFixed(e.fuel === "CNG" ? 3 : 2)}</td>
                              <td>
                                {e.type === "Opening Credit" || e.type === "Opening Debit"
                                  ? moneyRupee(openingOutstanding)
                                  : ""}
                              </td>
                              <td>{moneyRupee(e.debit)}</td>
                              <td>{moneyRupee(e.credit)}</td>
                              <td><b>{moneyRupee(running)}</b></td>
                              <td>{e.note}</td>
                              <td>
                                <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="btn small"
                                    onClick={() => editLedgerEntry(e)}
                                  >
                                    ✎ Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn red small"
                                    onClick={() => deleteLedgerEntry(e)}
                                  >
                                    🗑 Delete
                                  </button>
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   STANDARD ACCOUNTING
========================================================= */
export function Accounts({data}){
  const [selectedFY,setSelectedFY]=useState(DEFAULT_FINANCIAL_YEAR);
  const fy=financialYearBounds(selectedFY);
  const [from,setFrom]=useState(fy.start); const [to,setTo]=useState(todayISODate()<fy.end?todayISODate():fy.end);
  useEffect(()=>{setFrom(fy.start);setTo(todayISODate()<fy.end?todayISODate():fy.end);},[selectedFY]);
  const [tab,setTab]=useState('trial');
  const snap=useMemo(()=>accountingSnapshot(data,from,to),[data,from,to]);
  const tb=useMemo(()=>trialBalance(data,from,to),[data,from,to]);
  const journal=useMemo(()=>standardJournal(data,from,to).slice().reverse(),[data,from,to]);
  const totalD=tb.reduce((s,x)=>s+x.debit,0), totalC=tb.reduce((s,x)=>s+x.credit,0);
  const exportCsv=()=>{ const rows=tab==='trial'?[['Account','Debit','Credit','Balance'],...tb.map(x=>[x.account,x.debit,x.credit,x.balance])]:[['Date','Account','Debit','Credit','Narration'],...journal.map(x=>[x.date,x.account,x.debit,x.credit,x.narration])]; const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`PumpPro_${tab}_${from}_to_${to}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <div className="content"><section className="panel"><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'end'}}><div><h2>📚 Accounts</h2><p style={{margin:0,color:'#64748b'}}>Standard double-entry accounting view. Historical operational data is preserved; no special-case collection rule is used. CNG/MS/HSD Sales in Accounts are taken from the same sales register as the Sale Report; for a like-for-like comparison use the same date range.</p></div><button className="btn" onClick={exportCsv}>⬇ Export CSV</button></div><div className="form" style={{marginTop:16}}><label>Financial Year<select value={selectedFY} onChange={e=>setSelectedFY(e.target.value)}>{FINANCIAL_YEARS.map(y=><option key={y.value} value={y.value}>{y.label}</option>)}</select></label><label>From Date<input type="date" min={START_DATE} value={from} onChange={e=>{const v=e.target.value; if(!assertPeriodDate(v,'From Date')) setFrom(v);}}/></label><label>To Date<input type="date" min={START_DATE} value={to} onChange={e=>{const v=e.target.value; if(!assertPeriodDate(v,'To Date')) setTo(v);}}/></label></div></section>
  <div className="cards" style={{marginTop:16}}><div className="card"><span>Total Sales</span><strong>{money(snap.totalSales)}</strong></div><div className="card"><span>Fuel Receipts</span><strong>{money(snap.fuelReceipt)}</strong></div><div className="card"><span>Trade Receivables</span><strong>{money(snap.receivable)}</strong></div><div className="card"><span>Purchase Value</span><strong>{money(snap.purchaseTotal)}</strong></div></div>
  <div className="tabs" style={{display:'flex',gap:8,margin:'16px 0'}}><button className="btn" onClick={()=>setTab('trial')}>Trial Balance</button><button className="btn gray" onClick={()=>setTab('journal')}>Journal</button></div>
  {tab==='trial'?<section className="panel"><h3>Trial Balance</h3><div className="table"><table><thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{tb.map(x=><tr key={x.account}><td>{x.account}</td><td>{money(x.debit)}</td><td>{money(x.credit)}</td><td>{money(x.balance)}</td></tr>)}<tr className="total-row"><td>TOTAL</td><td>{money(totalD)}</td><td>{money(totalC)}</td><td>{money(totalD-totalC)}</td></tr></tbody></table></div><div className={`collection-note ${Math.abs(totalD-totalC)<1?'green-note':'red-note'}`}><b>{Math.abs(totalD-totalC)<1?'Balanced':'Check'}</b> — Debits and credits are {Math.abs(totalD-totalC)<1?'equal':'not equal'} for the selected period.</div></section>:<section className="panel"><h3>Journal</h3><div className="table"><table><thead><tr><th>Date</th><th>Account</th><th>Debit</th><th>Credit</th><th>Narration</th></tr></thead><tbody>{journal.map((x,i)=><tr key={i}><td>{x.date}</td><td>{x.account}</td><td>{money(x.debit)}</td><td>{money(x.credit)}</td><td>{x.narration}</td></tr>)}</tbody></table></div></section>}
  <section className="panel" style={{marginTop:16}}><h3>Accounting Classification</h3><div className="pro-info-row"><div className="pro-info green"><b>Revenue</b><span>Fuel Sale register is the sales source.</span></div><div className="pro-info orange"><b>Receivables</b><span>Credit sales and party balances are kept separately from cash receipts.</span></div><div className="pro-info red"><b>Expenses</b><span>Recorded pump expense is an expense entry, not sales receipt.</span></div></div></section></div>;
}

/* =========================================================
   REPORTS
========================================================= */

export function Reports({ data, totals }) {
  // Reports must use the same authoritative transaction policy as Stock, DSR and P&L.
  // Raw recovery representations are retained in backup/localStorage, but must never
  // appear as additional sales in monthly/daily product reports.
  const sales = authoritativeSalesRows(data);
  const payments = Array.isArray(data?.dailyPayments) ? data.dailyPayments : [];
  // Credit recoveries/duplicate representations are also excluded from credit-sale
  // reporting while the original credit transaction remains authoritative.
  const credits = ledgerCreditRows(Array.isArray(data?.credits) ? data.credits : []);
  const fuels = ["MS", "HSD", "CNG"];
  const unit = fuel => fuel === "CNG" ? "Kg" : "L";
  const qtyText = (fuel, q) => `${n(q).toFixed(fuel === "CNG" ? 3 : 2)} ${unit(fuel)}`;
  const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const csvEsc = v => `"${String(v ?? "").replaceAll('"','""')}"`;

  const months = useMemo(() => {
    const set = new Set();
    [...sales, ...payments, ...credits].forEach(x => {
      const d = String(x?.date || "");
      if (/^\d{4}-\d{2}/.test(d)) set.add(d.slice(0,7));
    });
    if (!set.size) set.add(START_DATE.slice(0,7));
    return [...set].sort().reverse();
  }, [sales, payments, credits]);
  const [month, setMonth] = useState(months[0] || START_DATE.slice(0,7));
  useEffect(() => {
    if (!months.includes(month)) setMonth(months[0] || START_DATE.slice(0,7));
  }, [months.join("|"), month]);

  const monthStart = `${month}-01`;
  const monthEnd = (() => {
    const [y,m] = month.split("-").map(Number);
    return `${month}-${String(new Date(y,m,0).getDate()).padStart(2,"0")}`;
  })();
  const inMonth = d => String(d || "") >= monthStart && String(d || "") <= monthEnd;
  const monthSales = useMemo(() => sales.filter(x => inMonth(x?.date)), [sales, month]);
  const monthPayments = useMemo(() => payments.filter(x => inMonth(x?.date)), [payments, month]);
  const monthCredits = useMemo(() => credits.filter(x => inMonth(x?.date)), [credits, month]);

  const salesByFuel = fuels.reduce((out, fuel) => {
    const rows = monthSales.filter(x => String(x?.fuel || "").toUpperCase() === fuel);
    out[fuel] = {
      qty: rows.reduce((a,x)=>a+n(x?.qty),0),
      amount: rows.reduce((a,x)=>a+n(x?.amount ?? n(x?.qty)*n(x?.rate)),0),
      entries: rows.length
    };
    return out;
  }, {});

  const dailyProductRows = useMemo(() => {
    const dates = Array.from(new Set(monthSales.map(x=>x?.date).filter(Boolean))).sort();
    return dates.map(date => fuels.map(fuel => {
      const rows = monthSales.filter(x=>x?.date===date && String(x?.fuel||"").toUpperCase()===fuel);
      return {
        date, fuel,
        qty: rows.reduce((a,x)=>a+n(x?.qty),0),
        amount: rows.reduce((a,x)=>a+n(x?.amount ?? n(x?.qty)*n(x?.rate)),0)
      };
    })).flat();
  }, [monthSales, month]);

  const paymentByFuel = fuels.reduce((out, fuel) => {
    const result = { cash:0, pos:0, dtplus:0, hppay:0, phonepe:0, credit:0, pumpExpense:0, receiptTotal:0, total:0, sale:0, difference:0 };
    monthPayments.forEach(p => {
      const nested = p?.[fuel] && typeof p[fuel] === "object" ? p[fuel] : null;
      if (!nested) return;
      result.cash += n(nested?.cash);
      result.pos += n(nested?.paytm) + n(nested?.card);
      result.dtplus += n(nested?.dtplus);
      result.hppay += n(nested?.hppay);
      result.phonepe += n(nested?.phonepe);
      result.pumpExpense += n(nested?.pumpExpense ?? nested?.other);
    });
    result.credit = monthCredits.filter(c=>String(c?.fuel||"").toUpperCase()===fuel).reduce((a,c)=>a+n(c?.amount),0);
    result.receiptTotal = result.cash + result.pos + result.dtplus + result.hppay + result.phonepe;
    result.total = result.receiptTotal + result.credit;
    result.sale = salesByFuel[fuel].amount;
    result.difference = rupee(result.sale - result.total - result.pumpExpense);
    out[fuel] = result;
    return out;
  }, {});

  const creditByFuel = fuels.reduce((out,fuel)=>{
    const rows=monthCredits.filter(c=>String(c?.fuel||"").toUpperCase()===fuel);
    out[fuel]={
      qty:rows.reduce((a,c)=>a+n(c?.qty),0), amount:rows.reduce((a,c)=>a+n(c?.amount),0),
      entries:rows.length, parties:new Set(rows.map(c=>String(c?.party||"").trim()).filter(Boolean)).size
    };
    return out;
  },{});
  const creditProducts = [...fuels, "LUBRICANT"];
  const creditByProduct = creditProducts.reduce((out,product)=>{
    const rows=monthCredits.filter(c=>String(c?.fuel||"").toUpperCase()===product);
    out[product]={
      qty:rows.reduce((a,c)=>a+n(c?.qty),0), amount:rows.reduce((a,c)=>a+n(c?.amount),0),
      entries:rows.length, parties:new Set(rows.map(c=>String(c?.party||"").trim()).filter(Boolean)).size
    };
    return out;
  },{});

  const monthSaleTotal = fuels.reduce((a,f)=>a+salesByFuel[f].amount,0);
  const monthFuelCreditTotal = fuels.reduce((a,f)=>a+creditByFuel[f].amount,0);
  const monthCreditTotal = creditProducts.reduce((a,f)=>a+creditByProduct[f].amount,0);
  const monthReceiptTotal = fuels.reduce((a,f)=>a+paymentByFuel[f].receiptTotal,0);

  const openPrint = (title, body) => {
    const w = window.open("", "_blank");
    if (!w) { alert("Print window blocked है. Chrome में Pop-ups and redirects → Allow करें, फिर Print / PDF दबाएँ।"); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{text-align:center;margin:0 0 6px}h2{margin-top:22px}table{width:100%;border-collapse:collapse;margin:10px 0 18px}th,td{border:1px solid #555;padding:7px;font-size:11px;text-align:right}th{background:#eee}th:first-child,td:first-child{text-align:left}.total{font-weight:800}.printbar{text-align:right;margin-bottom:12px}.printbtn{font-size:14px;padding:8px 16px;border:1px solid #555;border-radius:6px;background:#eee;cursor:pointer}@media print{.printbar{display:none}@page{size:A4 landscape;margin:10mm}}</style></head><body><div class="printbar"><button class="printbtn" onclick="window.focus();window.print()">🖨️ Print / Save PDF</button></div><h1>${PUMP_NAME}</h1><p><b>Month:</b> ${esc(month)}</p>${body}<script>window.addEventListener('load',()=>setTimeout(()=>{try{window.focus();window.print();}catch(e){}},500));<\/script></body></html>`;
    try { w.document.open(); w.document.write(html); w.document.close(); w.focus(); }
    catch (err) { try { w.close(); } catch {} alert("Print report खुल नहीं पाया। कृपया दोबारा Print / PDF दबाएँ।"); }
  };
  const downloadCsv = (filename, rows) => {
    const csv = rows.map(r=>r.map(csvEsc).join(",")).join("\\n");
    const blob=new Blob(["\\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const share = text => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank");

  const saleSummaryPrint = () => {
    const rows=fuels.map(f=>`<tr><td><b>${f}</b></td><td>${qtyText(f,salesByFuel[f].qty)}</td><td>${money(salesByFuel[f].amount)}</td><td>${salesByFuel[f].entries}</td></tr>`).join("");
    openPrint("Product-wise Sale Summary", `<h2>Product-wise Sale Summary — ${month}</h2><table><thead><tr><th>Product</th><th>Sale Qty</th><th>Sale Amount</th><th>Entries</th></tr></thead><tbody>${rows}<tr class="total"><td>TOTAL</td><td>—</td><td>${money(monthSaleTotal)}</td><td>${monthSales.length}</td></tr></tbody></table>`);
  };
  const saleSummaryWhatsApp = () => share([`*${PUMP_NAME}*`,`*Product-wise Sale Summary — ${month}*`,...fuels.map(f=>`${f}: ${qtyText(f,salesByFuel[f].qty)} | ${money(salesByFuel[f].amount)}`),`Total Sale: ${money(monthSaleTotal)}`].join("\n"));

  const dailyPrint = () => {
    const body=fuels.map(f=>{
      const rows=dailyProductRows.filter(r=>r.fuel===f);
      const totalQty=rows.reduce((a,r)=>a+n(r.qty),0);
      const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0);
      return `<h2>${f}</h2><table><thead><tr><th>Date</th><th>Product</th><th>Sale Qty</th><th>Sale Amount</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${f}</td><td>${qtyText(f,r.qty)}</td><td>${money(r.amount)}</td></tr>`).join("")}<tr class="total"><td colspan="2">TOTAL ${f}</td><td>${qtyText(f,totalQty)}</td><td>${money(totalAmount)}</td></tr></tbody></table>`;
    }).join("");
    openPrint("Product-wise Daily Sale Summary", `<h2>Product-wise Daily Sale Summary — ${month}</h2>${body}`);
  };
  const dailyExcel = () => downloadCsv(`Product_Wise_Daily_Sale_Summary_${month}.csv`, [[PUMP_NAME],[`Product-wise Daily Sale Summary — ${month}`],[],["Date","Product","Sale Qty","Sale Amount"],...dailyProductRows.map(r=>[r.date,r.fuel,r.qty,r.amount]),[],["TOTAL","ALL PRODUCTS",fuels.reduce((a,f)=>a+dailyProductRows.filter(r=>r.fuel===f).reduce((q,x)=>q+n(x.qty),0),0),fuels.reduce((a,f)=>a+dailyProductRows.filter(r=>r.fuel===f).reduce((q,x)=>q+n(x.amount),0),0)]]);
  const dailyWhatsApp = () => {
    const lines=[`*${PUMP_NAME}*`,`*Product-wise Daily Sale Summary — ${month}*`];
    fuels.forEach(f=>{
      const rows=dailyProductRows.filter(r=>r.fuel===f);
      const totalQty=rows.reduce((a,r)=>a+n(r.qty),0);
      const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0);
      lines.push(`*${f}*`);
      rows.forEach(r=>lines.push(`${r.date}: ${qtyText(f,r.qty)} | ${money(r.amount)}`));
      lines.push(`TOTAL ${f}: ${qtyText(f,totalQty)} | ${money(totalAmount)}`);
    });
    share(lines.join("\n"));
  };
  const dailyPrintFuel = fuel => {
    const rows=dailyProductRows.filter(r=>r.fuel===fuel);
    const totalQty=rows.reduce((a,r)=>a+n(r.qty),0);
    const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0);
    const body=`<h2>${fuel} — Daily Sale Summary</h2><table><thead><tr><th>Date</th><th>Product</th><th>Sale Qty</th><th>Sale Amount</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${fuel}</td><td>${qtyText(fuel,r.qty)}</td><td>${money(r.amount)}</td></tr>`).join("")}<tr class="total"><td colspan="2">TOTAL ${fuel}</td><td>${qtyText(fuel,totalQty)}</td><td>${money(totalAmount)}</td></tr></tbody></table>`;
    openPrint(`${fuel} Daily Sale Summary`, `<h2>${fuel} Daily Sale Summary — ${month}</h2>${body}`);
  };
  const dailyExcelFuel = fuel => {
    const rows=dailyProductRows.filter(r=>r.fuel===fuel);
    const totalQty=rows.reduce((a,r)=>a+n(r.qty),0);
    const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0);
    downloadCsv(`${fuel}_Daily_Sale_Summary_${month}.csv`, [[PUMP_NAME],[`${fuel} Daily Sale Summary — ${month}`],[],["Date","Product","Sale Qty","Sale Amount"],...rows.map(r=>[r.date,r.fuel,r.qty,r.amount]),[],["TOTAL",fuel,totalQty,totalAmount]]);
  };
  const dailyWhatsAppFuel = fuel => {
    const rows=dailyProductRows.filter(r=>r.fuel===fuel);
    const totalQty=rows.reduce((a,r)=>a+n(r.qty),0);
    const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0);
    share([`*${PUMP_NAME}*`,`*${fuel} Daily Sale Summary — ${month}*`,...rows.map(r=>`${r.date}: ${qtyText(fuel,r.qty)} | ${money(r.amount)}`),`*TOTAL ${fuel}: ${qtyText(fuel,totalQty)} | ${money(totalAmount)}*`].join("\n"));
  };

  const paymentRows = fuels.map(f=>[f,paymentByFuel[f].cash,paymentByFuel[f].pos,paymentByFuel[f].dtplus,paymentByFuel[f].hppay,paymentByFuel[f].phonepe,paymentByFuel[f].credit,paymentByFuel[f].pumpExpense,paymentByFuel[f].total,paymentByFuel[f].difference]);
  const paymentPrint = () => {
    const rows=paymentRows.map(r=>`<tr><td><b>${r[0]}</b></td>${r.slice(1).map(v=>`<td>${money(v)}</td>`).join("")}</tr>`).join("");
    openPrint("Product-wise Payment Report", `<h2>Product-wise Payment Report — ${month}</h2><table><thead><tr><th>Product</th><th>Cash</th><th>Paytm + ATM/POS</th><th>DT Plus</th><th>HP Pay</th><th>PhonePe</th><th>Credit</th><th>Pump Expense</th><th>Total Receipt</th><th>Difference</th></tr></thead><tbody>${rows}<tr class="total"><td>TOTAL</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].cash,0))}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].pos,0))}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].dtplus,0))}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].hppay,0))}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].phonepe,0))}</td><td>${money(monthFuelCreditTotal)}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].pumpExpense,0))}</td><td>${money(monthReceiptTotal)}</td><td>${money(fuels.reduce((a,f)=>a+paymentByFuel[f].difference,0))}</td></tr></tbody></table>`);
  };
  const paymentExcel = () => downloadCsv(`Product_Wise_Payment_Report_${month}.csv`, [[PUMP_NAME],[`Product-wise Payment Report — ${month}`],[],["Product","Cash","Paytm + ATM/POS","DT Plus","HP Pay","PhonePe","Credit","Pump Expense","Total Receipt","Difference"],...paymentRows]);
  const paymentWhatsApp = () => share([`*${PUMP_NAME}*`,`*Product-wise Payment Report — ${month}*`,...fuels.map(f=>{const p=paymentByFuel[f];return `${f}: Cash ${money(p.cash)} | POS ${money(p.pos)} | DT ${money(p.dtplus)} | HP ${money(p.hppay)} | PhonePe ${money(p.phonepe)} | Credit ${money(p.credit)} | Total ${money(p.total)}`;}),`Total Receipt: ${money(monthReceiptTotal)}`].join("\n"));

  const creditRows = creditProducts.map(f=>[f,creditByProduct[f].qty,creditByProduct[f].amount,creditByProduct[f].entries,creditByProduct[f].parties]);
  const creditPrint = () => openPrint("Product-wise Credit Sale Report", `<h2>Product-wise Credit Sale Report — ${month}</h2><table><thead><tr><th>Product</th><th>Credit Qty</th><th>Credit Amount</th><th>Entries</th><th>Parties</th></tr></thead><tbody>${creditRows.map(r=>`<tr><td><b>${r[0]}</b></td><td>${qtyText(r[0],r[1])}</td><td>${money(r[2])}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("")}<tr class="total"><td>TOTAL</td><td>—</td><td>${money(monthCreditTotal)}</td><td>${monthCredits.length}</td><td>—</td></tr></tbody></table>`);
  const creditExcel = () => downloadCsv(`Product_Wise_Credit_Sale_Report_${month}.csv`, [[PUMP_NAME],[`Product-wise Credit Sale Report — ${month}`],[],["Product","Credit Qty","Credit Amount","Entries","Parties"],...creditRows]);
  const creditWhatsApp = () => share([`*${PUMP_NAME}*`,`*Product-wise Credit Sale Report — ${month}*`,...creditProducts.map(f=>`${f}: ${qtyText(f,creditByProduct[f].qty)} | ${money(creditByProduct[f].amount)} | ${creditByProduct[f].entries} entries`),`Total Credit: ${money(monthCreditTotal)}`].join("\n"));

  const Actions = ({items}) => <div className="actions" style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>{items.map(([label,fn])=><button key={label} type="button" className="btn" onClick={fn}>{label}</button>)}</div>;

  return <div className="content">
    <section className="panel">
      <div className="pro-panel-head" style={{alignItems:"center"}}><div><h2 style={{marginBottom:4}}>📅 Reports — Monthly View</h2><span style={{color:"#6b7280"}}>सभी product-wise reports अब चुने हुए पूरे महीने के आधार पर दिखेंगे.</span></div><label style={{minWidth:170}}>Month<select value={month} onChange={e=>setMonth(e.target.value)} style={{width:"100%"}}>{months.map(m=><option key={m} value={m}>{m}</option>)}</select></label></div>
      <div className="cards" style={{marginTop:14}}><div className="card"><span>Monthly Sale</span><strong>{money(monthSaleTotal)}</strong></div><div className="card"><span>Monthly Credit</span><strong>{money(monthCreditTotal)}</strong></div><div className="card"><span>Payment Receipts</span><strong>{money(monthReceiptTotal)}</strong></div><div className="card"><span>Sale Entries</span><strong>{monthSales.length}</strong></div></div>
    </section>

    <section className="panel" style={{marginTop:18}}><h2>📊 Product-wise Sale Summary — {month}</h2><p style={{marginTop:0,color:"#6b7280"}}>पूरे selected month में MS / HSD / CNG का consolidated product-wise sale.</p><Actions items={[["🖨️ Print / PDF",saleSummaryPrint],["📊 Excel",()=>downloadCsv(`Product_Wise_Sale_Summary_${month}.csv`,[[PUMP_NAME],[`Product-wise Sale Summary — ${month}`],[],["Product","Sale Qty","Sale Amount","Entries"],...fuels.map(f=>[f,salesByFuel[f].qty,salesByFuel[f].amount,salesByFuel[f].entries]),[],["TOTAL","",monthSaleTotal,monthSales.length]])],["💬 WhatsApp",saleSummaryWhatsApp]]}/><div className="table" style={{marginTop:14}}><table><thead><tr><th>Product</th><th>Sale Qty</th><th>Sale Amount</th><th>Entries</th></tr></thead><tbody>{fuels.map(f=><tr key={f}><td><b>{f}</b></td><td>{qtyText(f,salesByFuel[f].qty)}</td><td>{money(salesByFuel[f].amount)}</td><td>{salesByFuel[f].entries}</td></tr>)}<tr className="total-row"><td>TOTAL</td><td>—</td><td>{money(monthSaleTotal)}</td><td>{monthSales.length}</td></tr></tbody></table></div></section>

    <section className="panel" style={{marginTop:18}}><h2>📅 Product-wise Daily Sale Summary — {month}</h2><p style={{marginTop:0,color:"#6b7280"}}>Selected month के हर दिन MS / HSD / CNG की अलग-अलग sale.</p><Actions items={[["🖨️ Print / PDF — All",dailyPrint],["📊 Excel — All",dailyExcel],["💬 WhatsApp — All",dailyWhatsApp]]}/>{fuels.map(f=>{ const rows=dailyProductRows.filter(r=>r.fuel===f); const totalQty=rows.reduce((a,r)=>a+n(r.qty),0); const totalAmount=rows.reduce((a,r)=>a+n(r.amount),0); return <div key={f} className="table" style={{marginTop:14}}><h3>{f}</h3><table><thead><tr><th>Date</th><th>Product</th><th>Sale Qty</th><th>Sale Amount</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.date}-${r.fuel}`}><td>{r.date}</td><td><b>{f}</b></td><td>{qtyText(f,r.qty)}</td><td>{money(r.amount)}</td></tr>)}<tr className="total-row"><td colSpan="2"><b>TOTAL {f}</b></td><td><b>{qtyText(f,totalQty)}</b></td><td><b>{money(totalAmount)}</b></td></tr></tbody></table><Actions items={[["🖨️ Print / PDF",()=>dailyPrintFuel(f)],["📊 Excel",()=>dailyExcelFuel(f)],["💬 WhatsApp",()=>dailyWhatsAppFuel(f)]]}/></div>; })}</section>

    <section className="panel" style={{marginTop:18}}><h2>💳 Product-wise Payment Report — {month}</h2><p style={{marginTop:0,color:"#6b7280"}}>पूरे selected month में fuel/product के अनुसार receipt और credit reconciliation.</p><Actions items={[["🖨️ Print / PDF",paymentPrint],["📊 Excel",paymentExcel],["💬 WhatsApp",paymentWhatsApp]]}/><div className="table" style={{marginTop:14}}><table><thead><tr><th>Product</th><th>Cash</th><th>Paytm + ATM/POS</th><th>DT Plus</th><th>HP Pay</th><th>PhonePe</th><th>Credit</th><th>Pump Expense</th><th>Total Receipt</th><th>Difference</th></tr></thead><tbody>{fuels.map(f=>{const p=paymentByFuel[f];return <tr key={f}><td><b>{f}</b></td><td>{money(p.cash)}</td><td>{money(p.pos)}</td><td>{money(p.dtplus)}</td><td>{money(p.hppay)}</td><td>{money(p.phonepe)}</td><td>{money(p.credit)}</td><td>{money(p.pumpExpense)}</td><td>{money(p.total)}</td><td>{money(p.difference)}</td></tr>})}</tbody></table></div></section>

    <section className="panel" style={{marginTop:18}}><h2>🧾 Product-wise Credit Sale Report — {month}</h2><p style={{marginTop:0,color:"#6b7280"}}>Selected month के Credit Sale Register से MS / HSD / CNG और Lubricant/Mobile Oil का product-wise सारांश.</p><Actions items={[["🖨️ Print / PDF",creditPrint],["📊 Excel",creditExcel],["💬 WhatsApp",creditWhatsApp]]}/><div className="table" style={{marginTop:14}}><table><thead><tr><th>Product</th><th>Credit Qty</th><th>Credit Amount</th><th>Entries</th><th>Parties</th></tr></thead><tbody>{creditProducts.map(f=><tr key={f}><td><b>{f === "LUBRICANT" ? "Lubricant / Mobile Oil" : f}</b></td><td>{qtyText(f,creditByProduct[f].qty)}</td><td>{money(creditByProduct[f].amount)}</td><td>{creditByProduct[f].entries}</td><td>{creditByProduct[f].parties}</td></tr>)}<tr className="total-row"><td>TOTAL</td><td>—</td><td>{money(monthCreditTotal)}</td><td>{monthCredits.length}</td><td>—</td></tr></tbody></table></div></section>

    <section className="panel" style={{marginTop:18}}><h2>Receivable Recovery — Product-wise — {month}</h2><Table headers={["Date","Fuel","Received","Pending Before Recovery"]} rows={(Array.isArray(data?.recoveries)?data.recoveries:[]).filter(r=>inMonth(r?.date)).slice().reverse().map(r=>[r.date,r.fuel,money(r.amount),money(r.againstPending)])}/></section>
  </div>;
}


/* =========================================================
   SALE / PURCHASE / PROFIT & LOSS
   ========================================================= */


/* =========================================================
   LUBRICANT MANAGEMENT — MOBILE OIL / HPCL
   Opening stock is optional and can be entered later. Credit Sale rows
   already stored with fuel=LUBRICANT are the authoritative lubricant sales.
========================================================= */
// Normalize HPCL inventory descriptions to the parent product. Pack size remains in the source bill,
// but stock costing is consolidated at product level so paid + free quantities receive one
// GST-inclusive effective purchase cost. DEF remains its own product and never mixes with oils.
const LUBRICANT_PACK_SALE_PRICES = Object.freeze({
  "HP GEAR OIL EP 140": [{ pack:"210 L Drum", price:61500 }],
  "HP LAAL GHODA 20W40": [
    { pack:"1 L", price:295 },
    { pack:"5 L", price:1475 },
    { pack:"10 L", price:2950 },
    { pack:"20 L", price:5900 }
  ],
  "HP RACER 4 20W40": [{ pack:"1 L", price:345 }],
  "HP MILCY TURBO 15W40": [
    { pack:"1 L", price:325 },
    { pack:"4×5 L", price:6530 },
    { pack:"7.5 L", price:2450 },
    { pack:"10 L", price:3265 }
  ],
  "TATA MOTORS HP GENUINE DEF": [{ pack:"20 L Bucket", price:2000 }]
});

const lubricantSalePriceOptions = value => {
  const key = normalizeLubricantProductName(value).toUpperCase();
  return LUBRICANT_PACK_SALE_PRICES[key] || [];
};

export function normalizeLubricantProductName(value) {
  let name=String(value||"").replace(/\\s+/g," ").trim();
  if(!name) return "";
  name=name.replace(/\\s*[-–]\\s*\\d+(?:\\.\\d+)?\\s*[x×]\\s*\\d+(?:\\.\\d+)?\\s*L(?:\\s*SQ)?\\s*$/i,"");
  name=name.replace(/\\s+\\d+(?:\\.\\d+)?\\s*L\\s*$/i,"");
  return name.replace(/\\s+/g," ").trim();
}

export function LubricantManagement({ data, update }) {
  const [selectedFY,setSelectedFY]=useState(DEFAULT_FINANCIAL_YEAR);
  const fy=financialYearBounds(selectedFY);
  const today = todayDate();
  const opening = data?.openingStock || {};
  const openingByFY = data?.openingStockByFY || {};
  const [openingQty, setOpeningQty] = useState(opening.LUBRICANT_QTY ?? "");
  const [openingValue, setOpeningValue] = useState(opening.LUBRICANT_VALUE ?? "");
  const [purchase, setPurchase] = useState({date:today, invoiceNo:"", supplier:"HINDUSTAN PETROLEUM CORP. LTD.", productName:"Mobile Oil (HPCL)", quantity:"", rate:"", taxRate:"", taxAmount:"", totalAmount:""});
  const [purchaseBillFile, setPurchaseBillFile] = useState(null);
  const [msg, setMsg] = useState("");

  // Product options are taken from uploaded HPCL purchase bill item lines.
  const lubricantProductOptions = useMemo(() => {
    const map = new Map();
    (data.purchases || []).filter(p => String(p?.fuel || "").toUpperCase() === "LUBRICANT").forEach(p => {
      const items = Array.isArray(p.items) && p.items.length ? p.items : [{ description: p.productName || "Mobile Oil (HPCL)", hsn: p.hsn || "" }];
      items.forEach(item => {
        const name = String(item?.description || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (!map.has(key)) map.set(key, { name, hsn: String(item?.hsn || "").trim(), invoiceNo: String(p.invoiceNo || "").trim() });
      });
    });
    return Array.from(map.values());
  }, [data.purchases]);

  // FY-wise lubricant opening: if a FY opening is carried forward, it is authoritative.
  // Otherwise the previous FY closing is calculated from the configured base opening and transactions.
  const previousFYBounds = useMemo(()=>{
    const y=Number(String(selectedFY).slice(0,4));
    if(!Number.isFinite(y)) return null;
    return {start:`${y-1}-04-01`, end:`${y}-03-31`};
  },[selectedFY]);

  const baseOpeningQ=n(data?.openingStock?.LUBRICANT_QTY);
  const baseOpeningV=n(data?.openingStock?.LUBRICANT_VALUE);
  const allLubPurchases=Array.isArray(data?.purchases)?data.purchases:[];
  const allLubCredits=Array.isArray(data?.credits)?data.credits:[];
  const allLubCash=Array.isArray(data?.lubricantCashSales)?data.lubricantCashSales:[];

  const calculatedPreviousClosing=useMemo(()=>{
    if(!previousFYBounds) return {qty:baseOpeningQ,value:baseOpeningV};
    const inPrev=x=>String(x?.date||"")>=previousFYBounds.start && String(x?.date||"")<=previousFYBounds.end;
    const pq=allLubPurchases.filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT"&&inPrev(x)).reduce((a,x)=>a+n(x.quantity),0);
    const pv=allLubPurchases.filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT"&&inPrev(x)).reduce((a,x)=>a+purchaseLandedValue(x),0);
    const cq=allLubCredits.filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT"&&inPrev(x)).reduce((a,x)=>a+n(x.qty),0);
    const cashq=allLubCash.filter(x=>String(x?.paymentMode||"").toUpperCase()==="CASH"&&inPrev(x)).reduce((a,x)=>a+n(x.qty),0);
    const qty=baseOpeningQ+pq-cq-cashq;
    const totalQ=baseOpeningQ+pq;
    const avg=totalQ>0?(baseOpeningV+pv)/totalQ:0;
    return {qty,value:Math.max(0,qty*avg)};
  },[previousFYBounds,baseOpeningQ,baseOpeningV,allLubPurchases,allLubCredits,allLubCash]);

  const effectiveOpening=openingByFY[selectedFY] || (String(selectedFY).startsWith("2026-") ? calculatedPreviousClosing : {qty:baseOpeningQ,value:baseOpeningV});

  useEffect(()=>{
    setOpeningQty(effectiveOpening?.qty ?? effectiveOpening?.LUBRICANT_QTY ?? "");
    setOpeningValue(effectiveOpening?.value ?? effectiveOpening?.LUBRICANT_VALUE ?? "");
  },[selectedFY,effectiveOpening?.qty,effectiveOpening?.value,effectiveOpening?.LUBRICANT_QTY,effectiveOpening?.LUBRICANT_VALUE]);

  const carryForwardOpening=()=>{
    const q=n(calculatedPreviousClosing.qty), v=n(calculatedPreviousClosing.value);
    if(q<0||v<0) return setMsg("❌ Previous FY closing stock invalid है।");
    update({openingStockByFY:{...(data?.openingStockByFY||{}),[selectedFY]:{qty:q,value:v,source:"CARRY_FORWARD",fromFY:`${Number(String(selectedFY).slice(0,4))-1}-${String(selectedFY).slice(0,4).slice(0,2)}`}}});
    setOpeningQty(q); setOpeningValue(v);
    setMsg(`✅ Previous FY closing stock carry-forward हो गया: ${q.toFixed(2)} L · ${money(v)}`);
  };

  const sales = useMemo(()=>ledgerCreditRows(Array.isArray(data?.credits)?data.credits:[])
    .filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT" && x.date>=fy.start && x.date<=fy.end)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))),[data?.credits,selectedFY]);
  const purchases = useMemo(()=> (Array.isArray(data?.purchases)?data.purchases:[])
    .filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT" && x.date>=fy.start && x.date<=fy.end)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date))),[data?.purchases,selectedFY]);
  const cashSales = useMemo(()=> (Array.isArray(data?.lubricantCashSales)?data.lubricantCashSales:[])
    .filter(x=>String(x?.paymentMode||"").toUpperCase()==="CASH" && x.date>=fy.start && x.date<=fy.end)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))),[data?.lubricantCashSales,selectedFY]);

  // Item-wise stock ledger. HPCL invoices can contain multiple item lines in one
  // purchase row, so inventory is calculated from each line's inventoryQty.
  const lubricantStockItems = useMemo(()=>{
    const map=new Map();
    const add=(name,meta={})=>{
      const clean=String(name||"").trim();
      if(!clean) return;
      const key=clean.toLowerCase();
      if(!map.has(key)) map.set(key,{name:clean,hsn:String(meta.hsn||"").trim()});
      else if(meta.hsn && !map.get(key).hsn) map.get(key).hsn=String(meta.hsn).trim();
    };
    purchases.forEach(p=>{
      if(Array.isArray(p.items) && p.items.length){
        p.items.forEach(item=>add(normalizeLubricantProductName(item?.description),{hsn:item?.hsn}));
      } else if(String(p?.source||"").toUpperCase()==="HPCL-LUBRICANT-PDF"){
        // Never guess an item/SKU for a legacy HPCL bill whose item lines were not saved.
        // Keep the quantity visible under an explicit unclassified bucket until the
        // original saved bill attachment is re-read successfully.
        add("⚠️ UNCLASSIFIED HPCL PURCHASE (ITEM LINES UNAVAILABLE)");
      } else add(p.productName);
    });
    sales.forEach(x=>add(x.productName));
    cashSales.forEach(x=>add(x.productName));
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name));
  },[purchases,sales,cashSales]);

  const lubricantItemLedger = useMemo(()=>{
    const saved=(data?.lubricantOpeningByFY?.[selectedFY]||{});
    return lubricantStockItems.map(item=>{
      const key=item.name.toLowerCase();
      const openingRow=saved[key]||saved[item.name]||{};
      const isUnclassifiedHPCL=key==="⚠️ unclassified hpcl purchase (item lines unavailable)";
      const itemPurchases=purchases.filter(p=>{
        if(Array.isArray(p.items) && p.items.length) return p.items.some(x=>normalizeLubricantProductName(x?.description).toLowerCase()===key);
        if(isUnclassifiedHPCL) return String(p?.source||"").toUpperCase()==="HPCL-LUBRICANT-PDF";
        return String(p.productName||"").trim().toLowerCase()===key;
      });
      let purchaseQty=0, purchaseValue=0;
      itemPurchases.forEach(p=>{
        if(Array.isArray(p.items) && p.items.length){
          p.items.forEach(x=>{
            if(normalizeLubricantProductName(x?.description).toLowerCase()!==key) return;
            const q=n(x?.inventoryQty)>0?n(x.inventoryQty):0;
            purchaseQty+=q;
            const lineValue=n(x?.netAmount)>0?n(x.netAmount):n(x?.taxableValue)+n(x?.igstAmount);
            purchaseValue+=lineValue>0?lineValue:0;
          });
        } else {
          purchaseQty+=n(p.quantity);
          purchaseValue+=purchaseLandedValue(p);
        }
      });
      const credit=sales.filter(x=>String(x?.productName||"").trim().toLowerCase()===key);
      const cash=cashSales.filter(x=>String(x?.productName||"").trim().toLowerCase()===key);
      const creditQty=credit.reduce((a,x)=>a+n(x.qty),0);
      const cashQty=cash.reduce((a,x)=>a+n(x.qty),0);
      const creditValue=credit.reduce((a,x)=>a+n(x.amount),0);
      const cashValue=cash.reduce((a,x)=>a+n(x.amount),0);
      const openingQtyItem=n(openingRow.qty);
      const openingValueItem=n(openingRow.value);
      const availableQty=openingQtyItem+purchaseQty;
      const avgItemCost=availableQty>0?(openingValueItem+purchaseValue)/availableQty:0;
      const closingQtyItem=availableQty-creditQty-cashQty;
      return {
        ...item, key, openingQty:openingQtyItem, openingValue:openingValueItem,
        purchaseQty, purchaseValue, creditQty, creditValue, cashQty, cashValue,
        closingQty:closingQtyItem, avgCost:avgItemCost,
        closingValue:Math.max(0,closingQtyItem*avgItemCost)
      };
    });
  },[lubricantStockItems,purchases,sales,cashSales,data?.lubricantOpeningByFY,selectedFY]);

  const [itemOpeningDraft,setItemOpeningDraft]=useState({});
  useEffect(()=>{
    const saved=data?.lubricantOpeningByFY?.[selectedFY]||{};
    const next={};
    lubricantStockItems.forEach(item=>{
      const row=saved[item.key]||saved[item.name]||{};
      next[item.key]={qty:row.qty??"",value:row.value??""};
    });
    setItemOpeningDraft(next);
  },[selectedFY,lubricantStockItems,data?.lubricantOpeningByFY]);

  const saveItemWiseOpening=async()=>{
    const existing={...(data?.lubricantOpeningByFY||{})};
    const next={};
    for(const item of lubricantStockItems){
      const row=itemOpeningDraft[item.key]||{};
      const qty=n(row.qty), value=n(row.value);
      if(qty<0 || value<0) return setMsg("❌ Item-wise opening stock में negative Qty/Value नहीं हो सकता।");
      if(qty>0 || value>0) next[item.key]={qty,value};
    }
    existing[selectedFY]=next;
    const result=await update({lubricantOpeningByFY:existing});
    if(result?.ok===false) return setMsg("❌ Item-wise Opening Stock save नहीं हुआ: "+(result?.reason||"Mutation rejected"));
    setMsg("✅ Item-wise Lubricant Opening Stock save हो गया।");
  };

  const openingQ=n(openingQty), openingV=n(openingValue);
  const purchaseQ=purchases.reduce((a,x)=>a+n(x.quantity),0);
  const purchaseV=purchases.reduce((a,x)=>a+purchaseLandedValue(x),0);
  const saleQ=sales.reduce((a,x)=>a+n(x.qty),0) + cashSales.reduce((a,x)=>a+n(x.qty),0);
  const saleV=sales.reduce((a,x)=>a+n(x.amount),0) + cashSales.reduce((a,x)=>a+n(x.amount),0);
  const totalQty=openingQ+purchaseQ;
  const avgCost=totalQty>0?(openingV+purchaseV)/totalQty:0;
  const closingQty=totalQty-saleQ;
  const closingValue=Math.max(0,closingQty*avgCost);
  const qtyMissingSales=sales.filter(x=>n(x.qty)<=0 && n(x.amount)>0).length;
  const reconciliationStatus=closingQty>=0 && qtyMissingSales===0 ? "OK" : (qtyMissingSales>0 ? "QTY PENDING" : "CHECK");

  // Register हमेशा transaction/bill date से चलेगा। uploadedAt केवल attachment metadata है;
  // उसे कभी accounting/stock transaction date की तरह display या filter नहीं किया जाता।
  const lubricantBillDate = p => {
    const d=String(p?.date||"").trim();
    return isValidISODate(d) ? d : "—";
  };

  const saveOpening=()=>{
    const q=n(openingQty), v=n(openingValue);
    if(q<0||v<0) return setMsg("Opening Stock quantity/value negative नहीं हो सकता।");
    update({openingStockByFY:{...(data?.openingStockByFY||{}),[selectedFY]:{qty:q,value:v,source:"MANUAL"}}});
    setMsg(`✅ Lubricant Opening Stock saved: ${q.toFixed(2)} Qty · ${money(v)}. इसे बाद में भी edit किया जा सकता है।`);
  };

  const [editingPurchaseId,setEditingPurchaseId]=useState(null);
  const [editingCashSaleId,setEditingCashSaleId]=useState(null);
  const [cashSale,setCashSale]=useState({date:today,productName:"Mobile Oil (HPCL)",packQty:"",packSize:"",qty:"",rate:"",amount:""});
  const [editingSaleId,setEditingSaleId]=useState(null);
  const [editingSale,setEditingSale]=useState({date:today,parchiNo:"",party:"",vehicle:"",productName:"Mobile Oil (HPCL)",qty:"",amount:""});


  const resetCashSaleForm=()=>{
    setEditingCashSaleId(null);
    setCashSale({date:today,productName:"Mobile Oil (HPCL)",packQty:"",packSize:"",qty:"",rate:"",amount:""});
  };

  const saveCashSale=async()=>{
    setMsg("");
    if(!cashSale.date || !isValidISODate(cashSale.date) || cashSale.date<START_DATE || cashSale.date>today) return setMsg("Cash Sale Date valid period में नहीं है।");
    if(!String(cashSale.productName||"").trim()) return setMsg("Uploaded Bill से Product Select करना जरूरी है।");
    const qty=(n(cashSale.packQty)>0&&n(cashSale.packSize)>0)?rupee(n(cashSale.packQty)*n(cashSale.packSize)):n(cashSale.qty), rate=n(cashSale.rate), inclusiveAmount=rupee(qty*rate), taxableAmount=rupee(inclusiveAmount*100/118);
    const gstRate=18, gstAmount=rupee(inclusiveAmount-taxableAmount), amount=inclusiveAmount;
    if(qty<=0) return setMsg("Qty 0 से अधिक होना चाहिए।");
    if(rate<=0 && amount<=0) return setMsg("Rate या Amount भरें।");
    const finalRate=rate>0?rupee(rate):rupee(amount/qty);
    const finalAmount=rupee(amount>0?amount:qty*finalRate);
    const lockedMonths=new Set(Array.isArray(data?.accountingLocks?.months)?data.accountingLocks.months.map(String):[]);
    if(lockedMonths.has(String(cashSale.date).slice(0,7))) return setMsg("🔒 "+String(cashSale.date).slice(0,7)+" Accounting Month LOCKED है।");
    if(editingCashSaleId!==null){
      const next=(data.lubricantCashSales||[]).map(x=>String(x.id)===String(editingCashSaleId)?{
        ...x,date:cashSale.date,productName:String(cashSale.productName).trim(),qty,rate:finalRate,amount:finalAmount,paymentMode:"CASH"
      }:x);
      const result=await update({lubricantCashSales:next});
      if(!result?.ok) return setMsg("❌ Lubricant Cash Sale update नहीं हुई: "+(result?.reason||"Mutation rejected"));
      resetCashSaleForm();
      return setMsg("✅ Lubricant Cash Sale updated: "+money(finalAmount));
    }
    const now=Date.now();
    const row={
      id:"LUB-CASH-"+cashSale.date+"-"+now+"-"+Math.random().toString(36).slice(2,7),
      transactionId:"LUBRICANT-CASH-SALE-"+cashSale.date+"-"+now,
      date:cashSale.date,productName:String(cashSale.productName).trim(),qty,rate:qty>0?rupee(taxableAmount/qty):finalRate,amount:finalAmount,taxableAmount,gstRate,gstAmount,paymentMode:"CASH",source:"MANUAL_LUBRICANT_CASH"
    };
    const result=await update({lubricantCashSales:[...(data.lubricantCashSales||[]),row]});
    if(!result?.ok) return setMsg("❌ Lubricant Cash Sale save नहीं हुई: "+(result?.reason||"Mutation rejected"));
    resetCashSaleForm();
    setMsg("✅ Lubricant Cash Sale saved: "+money(finalAmount)+" · "+qty.toFixed(2)+" L · Cash");
  };

  const editCashSale=row=>{
    if(!row) return;
    setEditingCashSaleId(row.id);
    setCashSale({date:row.date||today,productName:row.productName||"Mobile Oil (HPCL)",qty:row.qty??"",rate:row.rate??"",amount:row.amount??""});
    setMsg("✏️ Lubricant Cash Sale edit mode में है।");
  };

  const deleteCashSale=async row=>{
    if(!row) return;
    if(!window.confirm("Lubricant Cash Sale "+(row.date||"—")+" · "+money(row.amount)+" delete करना है?")) return;
    const result=await update({lubricantCashSales:(data.lubricantCashSales||[]).filter(x=>String(x.id)!==String(row.id))});
    if(result?.ok===false) return setMsg("❌ Lubricant Cash Sale delete नहीं हुई: "+(result?.reason||"Mutation rejected"));
    if(String(editingCashSaleId)===String(row.id)) resetCashSaleForm();
    setMsg("🗑️ Lubricant Cash Sale delete हो गई।");
  };

  const resetSaleForm=()=>{
    setEditingSaleId(null);
    setEditingSale({date:today,parchiNo:"",party:"",vehicle:"",productName:"Mobile Oil (HPCL)",qty:"",amount:""});
  };

  const editSale=(row)=>{
    if(!row) return;
    setEditingSaleId(row.id);
    setEditingSale({
      date:row.date||today, parchiNo:String(row.parchiNo??""), party:row.party??"",
      vehicle:row.vehicle??"", productName:row.productName||"Mobile Oil (HPCL)",
      qty:row.qty??"", amount:row.amount??""
    });
    setMsg(`✏️ Lubricant Sale Edit mode: Parchi ${row.parchiNo||"—"}. नीचे values बदलकर Update करें।`);
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  };

  const saveEditedSale=async()=>{
    if(editingSaleId===null) return;
    const row=(data.credits||[]).find(x=>String(x.id)===String(editingSaleId));
    if(!row) return setMsg("❌ Lubricant Sale edit record नहीं मिला।");
    const parchi=String(editingSale.parchiNo||"").trim();
    if(!parchi || !editingSale.party) return setMsg("Parchi No और Party जरूरी हैं।");
    if(!isValidISODate(editingSale.date) || editingSale.date<START_DATE || editingSale.date>today) return setMsg("Date valid period में नहीं है।");
    if(!String(editingSale.productName||"").trim()) return setMsg("Uploaded Bill से Product Select करना जरूरी है।");
    const taxableAmount=rupee(n(editingSale.amount)*100/118);
    if(taxableAmount<=0) return setMsg("Taxable Amount ₹0 से अधिक होना चाहिए।");
    const gstRate=18;
    const gstAmount=rupee(n(editingSale.amount)-taxableAmount);
    const amount=rupee(taxableAmount+gstAmount);
    const duplicate=(data.credits||[]).some(c=>String(c.id)!==String(editingSaleId) && String(c?.parchiNo||"").trim().toLowerCase()===parchi.toLowerCase());
    if(duplicate) return setMsg(`Parchi No. ${parchi} पहले से मौजूद है।`);
    const qty=n(editingSale.qty);
    const nextRow={
      ...row,
      date:editingSale.date,
      parchiNo:parchi,
      party:String(editingSale.party).trim(),
      vehicle:String(editingSale.vehicle||"").toUpperCase(),
      fuel:"LUBRICANT",
      productName:String(editingSale.productName).trim(),
      qty,
      rate:qty>0?rupee(taxableAmount/qty):0,
      amount,
      taxableAmount,
      gstRate,
      gstAmount
    };
    // This is a protected CREDIT_SALE row too; re-sign it after editing.
    nextRow.fingerprint=transactionFingerprint("CREDIT_SALE",nextRow);
    nextRow.fingerprintVersion=2;
    const result=await update({credits:(data.credits||[]).map(c=>String(c.id)===String(editingSaleId)?nextRow:c)});
    if(!result?.ok) return setMsg(`❌ Lubricant Sale update नहीं हुआ: ${result?.reason||"Mutation rejected"}`);
    resetSaleForm();
    setMsg(`✅ Lubricant Sale updated: Parchi ${parchi} · ${money(amount)}`);
  };

  const deleteSale=(row)=>{
    if(!row) return;
    if(!window.confirm(`Lubricant Sale Parchi ${row.parchiNo||"—"} (${row.date||"—"}) delete करना है?\n\nयह action accounting mutation/lock checks के बाद ही save होगा।`)) return;
    update({credits:(data.credits||[]).filter(c=>String(c.id)!==String(row.id))}).then?.(result=>{
      if(result?.ok===false) setMsg(`❌ Lubricant Sale delete नहीं हुई: ${result.reason||"Mutation rejected"}`);
      else { if(editingSaleId===row.id) resetSaleForm(); setMsg(`🗑️ Lubricant Sale Parchi ${row.parchiNo||""} delete हो गई।`); }
    });
  };

  const resetPurchaseForm=()=>{
    setEditingPurchaseId(null);
    setPurchase({date:today, invoiceNo:"", supplier:"HINDUSTAN PETROLEUM CORP. LTD.", productName:"Mobile Oil (HPCL)", quantity:"", rate:"", taxRate:"", taxAmount:"", totalAmount:""});
    setPurchaseBillFile(null);
  };

  const editPurchase=(row)=>{
    if(!row) return;
    setEditingPurchaseId(row.id);
    setPurchaseBillFile(null);
    setPurchase({
      date:row.date||today, invoiceNo:row.invoiceNo||"", supplier:row.supplier||"HINDUSTAN PETROLEUM CORP. LTD.",
      productName:row.productName||"Mobile Oil (HPCL)", quantity:row.quantity??"", rate:row.rate??"",
      taxRate:row.taxRate??"", taxAmount:row.taxAmount??"", totalAmount:row.totalAmount??row.amount??""
    });
    setMsg(`✏️ Purchase Edit mode: Invoice ${row.invoiceNo||"—"}. Bill upload करने पर पुराना attachment replace होगा।`);
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
  };

  const deletePurchase=(row)=>{
    if(!row) return;
    const label=`${row.invoiceNo||"—"} (${row.date||"—"})`;
    if(!window.confirm(`Lubricant Purchase ${label} delete करना है?\n\nयह action accounting mutation/lock checks के बाद ही save होगा।`)) return;
    const id=row.id;
    const next=(data.purchases||[]).filter(p=>p!==row && p.id!==id);
    update({purchases:next}).then?.(result=>{
      if(result?.ok===false) setMsg(`❌ Purchase delete नहीं हुआ: ${result.reason||"Mutation rejected"}`);
      else { if(editingPurchaseId===id) resetPurchaseForm(); setMsg(`🗑️ Lubricant purchase ${row.invoiceNo||""} delete हो गया।`); }
    });
  };

  const addPurchase=async()=>{
    setMsg("");
    if(purchaseBillFile){
      if(!/^(application\/pdf|image\/(jpeg|png|webp))$/i.test(purchaseBillFile.type)) return setMsg("❌ Bill के लिए PDF/JPG/PNG/WEBP file चुनें।");
      if(purchaseBillFile.size>8*1024*1024) return setMsg("❌ Bill file 8 MB से छोटी रखें।");
    }
    if(!purchase.invoiceNo.trim()) return setMsg("Purchase Invoice No जरूरी है।");
    if(!purchase.productName.trim()) return setMsg("Product Name जरूरी है।");
    if(!purchase.date || purchase.date<START_DATE || purchase.date>today) return setMsg("Purchase Date selected Financial Year में होनी चाहिए।");
    if(n(purchase.quantity)<=0 || n(purchase.totalAmount)<=0) return setMsg("Quantity और Total Amount दोनों भरें।");
    const key=`LUBRICANT|${purchase.date}|${purchase.invoiceNo.trim().toUpperCase()}`;
    const dup=purchases.some(x=>x.id!==editingPurchaseId && `LUBRICANT|${x.date}|${String(x.invoiceNo||"").trim().toUpperCase()}`===key);
    if(dup) return setMsg("यह Lubricant invoice पहले से मौजूद है।");
    const qty=n(purchase.quantity), total=n(purchase.totalAmount), tax=n(purchase.taxAmount);
    const rate=n(purchase.rate)>0?n(purchase.rate):total/qty;
    if(editingPurchaseId){
      const old=(data.purchases||[]).find(x=>x.id===editingPurchaseId);
      if(!old) return setMsg("❌ Edit record नहीं मिला।");
      let attachment = {};
      if(purchaseBillFile) attachment = {billFileName:purchaseBillFile.name,billFileType:purchaseBillFile.type,billFileData:await readFileAsDataUrl(purchaseBillFile),uploadedAt:new Date().toISOString()};
      const row={...old,date:purchase.date,invoiceNo:purchase.invoiceNo.trim(),fuel:"LUBRICANT",productName:purchase.productName.trim(),supplier:purchase.supplier.trim(),quantity:qty,unit:old.unit||"L",rate,basicAmount:Math.max(0,total-tax),taxAmount:tax,totalAmount:total,amount:total,...attachment};
      // Bill attachment is part of the purchase record, so re-sign the edited row.
      // This keeps the integrity firewall consistent instead of treating a legitimate
      // bill upload as tampering with the purchase.
      row.fingerprint=transactionFingerprint('PURCHASE',row);
      row.fingerprintVersion=2;
      const result=await update({purchases:(data.purchases||[]).map(x=>x.id===editingPurchaseId?row:x)});
      if(!result?.ok) return setMsg(`❌ Lubricant Purchase edit save नहीं हुआ: ${result?.reason||"Mutation rejected"}`);
      resetPurchaseForm();
      return setMsg(`✅ Lubricant purchase updated: ${row.productName} · ${qty.toFixed(2)} L · ${money(total)}`);
    }
    const attachment = purchaseBillFile ? {billFileName:purchaseBillFile.name,billFileType:purchaseBillFile.type,billFileData:await readFileAsDataUrl(purchaseBillFile),uploadedAt:new Date().toISOString()} : {};
    const row={id:Date.now()+Math.random(),date:purchase.date,invoiceNo:purchase.invoiceNo.trim(),fuel:"LUBRICANT",productName:purchase.productName.trim(),supplier:purchase.supplier.trim(),quantity:qty,unit:"L",rate, basicAmount:Math.max(0,total-tax),taxAmount:tax,totalAmount:total,amount:total,source:"MANUAL_LUBRICANT",...attachment};
    const result=await update({purchases:[...(data.purchases||[]),row]});
    if(!result?.ok) return setMsg(`❌ Lubricant Purchase save नहीं हुआ: ${result?.reason||"Mutation rejected"}`);
    resetPurchaseForm();
    setMsg(`✅ Lubricant purchase saved: ${row.productName} · ${qty.toFixed(2)} L · ${money(total)}`);
  };


  // HPCL Lubricant bill import: a single invoice can contain many EA/pack lines.
  const [lubBillBusy,setLubBillBusy]=useState(false), [lubBillMsg,setLubBillMsg]=useState('');
  const [lubBillPreview,setLubBillPreview]=useState(null);

  const readFileAsDataUrl = file => new Promise((resolve,reject)=>{
    const fr=new FileReader(); fr.onload=()=>resolve(String(fr.result||'')); fr.onerror=()=>reject(new Error('file read failed')); fr.readAsDataURL(file);
  });

  // Open saved bill attachments through a Blob URL. Direct data: URLs can show a blank
  // Chrome tab for some PDFs/images, while Blob URLs render reliably in the browser viewer.
  const openPurchaseBill = async (dataUrl) => {
    if(!dataUrl) return;
    const win=window.open('about:blank','_blank');
    if(!win){ alert('Bill खोलने के लिए popup allow करें।'); return; }
    try{
      const blob=await fetch(dataUrl).then(res=>res.blob());
      const url=URL.createObjectURL(blob);
      win.location.href=url;
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){
      try{ win.location.href=dataUrl; }catch(_e){}
    }
  };

  const parseLubricantBillLines = (text,fileName='') => {
    const raw=String(text||'').replace(/\u00a0/g,' ');
    const lines=raw.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    const joined=lines.join(' ');
    const invoice=(joined.match(/INVOICE\s+NUMBER\s*[:.\-]?\s*([A-Z0-9-]+)/i)||joined.match(/INVOICE\s+NO\.?\s*[:.\-]?\s*([A-Z0-9-]+)/i)||[])[1]||'';
    const dateRaw=(joined.match(/(?:DOCUMENT\s+DATE|INVOICE\s+DATE|DATE)\s*[:.\-]?\s*((?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})|(?:\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{4})|(?:(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{1,2},?\s+\d{4}))/i)||[])[1]||'';
    const billDate=hpclDate2(dateRaw);
    const gstMatches=[...joined.matchAll(/GSTIN\s*[:.\-]?\s*([0-9A-Z]{15})/gi)].map(m=>m[1]);
    const gst=gstMatches.find(x=>x!=='05ABWFS5610D1Z4')||gstMatches[0]||'';
    const supplier='HINDUSTAN PETROLEUM CORP. LTD.';
    const items=[];
    const rowRe=/^(\d{1,3})\s+(.+?)\s+(\d{4,10})\s+([\d,]+(?:\.\d+)?)\s+(EA|L|KG|PCS)\s+(.+)$/i;
    const parseTail=tail=>{
      const nums=tail.trim().split(/\s+/).filter(Boolean).map(hpclNum2);
      if(nums.length>=8) return {totalValue:nums[0],discount:nums[1],taxableValue:nums[2],igstRate:0,igstAmount:nums[4]+nums[6],netAmount:nums[7]};
      if(nums.length>=6) return {totalValue:nums[0],discount:nums[1],taxableValue:nums[2],igstRate:nums[3],igstAmount:nums[4],netAmount:nums[5]};
      return null;
    };
    const addRow=(m)=>{
      const lineNo=Number(m[1]), description=m[2].trim(), hsn=String(m[3]), billedQty=hpclNum2(m[4]), unit=m[5].toUpperCase(), parsed=parseTail(m[6]);
      if(!parsed||!(billedQty>0)||!(parsed.netAmount>0)) return;
      const pack=description.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(L|LTR|LT)\b/i);
      const packCount=pack?Number(pack[1]):1, packLitres=pack?Number(pack[2]):(unit==='L'?1:0);
      const qtyVol=(description+' '+m[6]).match(/Qty\s*\/\s*Vol\s+([\d,]+(?:\.\d+)?)\s*L/i);
      const inventoryQty=qtyVol?hpclNum2(qtyVol[1]):(packLitres>0?billedQty*packCount:billedQty);
      items.push({lineNo,description,hsn,billedQty,unit,packSize:pack?pack[1]+' × '+pack[2]+' L':'',inventoryQty,...parsed});
    };
    for(const line of lines){ const m=line.match(rowRe); if(m) addRow(m); }

    // HPCL invoices often wrap the product description and Qty/Vol across
    // separate PDF text lines. Rebuild those fields from the item block so
    // 8-digit HSNs and EA-pack products are imported with the real product
    // name and inventory quantity.
    items.forEach(item=>{
      const hsnToken=String(item.hsn||'');
      const rowIndex=lines.findIndex(line=>new RegExp('^\\s*'+String(item.lineNo)+'\\s+').test(line) && line.includes(hsnToken));
      if(rowIndex<0) return;
      const block=[];
      for(let j=rowIndex;j<lines.length;j++){
        const s=lines[j];
        if(j>rowIndex && /^\s*\d{1,3}\s+/.test(s) && /\b\d{4,10}\b/.test(s)) break;
        if(j>rowIndex && /^(Total:|Net Amount|Declarations|PAN No\.|Goods\/Services)/i.test(s)) break;
        block.push(s);
      }
      const qtyMatch=block.join(' ').match(/Qty\s*\/\s*Vol\s+([\d,]+(?:\.\d+)?)\s*L/i);
      if(qtyMatch) item.inventoryQty=hpclNum2(qtyMatch[1]);

      const isMetaDescription=/^Locn\s+Lot\s+No\.?$/i.test(String(item.description||'').trim());
      if(isMetaDescription){
        const desc=[];
        for(let j=rowIndex-1;j>=0;j--){
          const s=String(lines[j]||'').trim();
          if(!s) continue;
          if(/^\s*\d{1,3}\s+/.test(s) && /\b\d{4,10}\b/.test(s)) break;
          if(/^(?:Locn\s+Lot\s+No\.?|MRP[0-9A-Z-]+|Qty\s*\/\s*Vol)/i.test(s)) continue;
          if(/^(?:Taxable|SR\s+Item|Description|HSN\/|Total:|Net Amount|Declarations)/i.test(s)) break;
          if(/^(?:GSTIN|Recipient|Delivery Address|Billing Doc No\.|Invoice Number|Document Type|Date\.)/i.test(s)) break;
          desc.unshift(s);
          if(desc.length>=3) break;
        }
        if(desc.length) item.description=desc.join(' ').replace(/\s+/g,' ').trim();
      }
    });

    if(!items.length){
      const m=joined.match(/\b(\d{1,3})\s+(.+?)\s+(\d{4,10})\s+([\d,]+(?:\.\d+)?)\s+(EA|L|KG|PCS)\s+([\d,]+(?:\.\d+)?(?:\s+[\d,]+(?:\.\d+)?){5,7})/i);
      if(m) addRow(m);
    }
    const totalInventoryQty=items.reduce((a,x)=>a+n(x.inventoryQty),0);
    const totalBasic=items.reduce((a,x)=>a+n(x.totalValue),0);
    const totalTaxable=items.reduce((a,x)=>a+n(x.taxableValue),0);
    const totalTax=items.reduce((a,x)=>a+n(x.igstAmount),0);
    const totalNet=items.reduce((a,x)=>a+n(x.netAmount),0);
    return {invoiceNo:String(invoice).trim(),date:billDate,supplier,gstin:String(gst).trim(),items,totalInventoryQty,totalBasic,totalTaxable,totalTax,totalNet,fileName,rawText:raw.slice(0,12000)};
  };

  const extractLubricantPdf = async file => {
    const pdfjsLib=await loadHpclPdfJs2();
    const buffer=await file.arrayBuffer(); const pdf=await pdfjsLib.getDocument({data:buffer}).promise; const all=[];
    for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
      const page=await pdf.getPage(pageNo); const content=await page.getTextContent();
      const items=content.items.filter(x=>String(x.str||'').trim()).map(x=>({text:String(x.str||'').trim(),x:Number(x.transform?.[4]||0),y:Number(x.transform?.[5]||0)}));
      const pageLines=[];
      for(const it of items){ let l=pageLines.find(z=>Math.abs(z.y-it.y)<=2.8); if(!l){l={y:it.y,items:[]};pageLines.push(l);} l.items.push(it); }
      for(const l of pageLines){ l.items.sort((a,b)=>a.x-b.x); all.push({page:pageNo,y:l.y,items:l.items,text:l.items.map(x=>x.text).join(' ').replace(/\s+/g,' ').trim()}); }
    }
    all.sort((a,b)=>a.page-b.page||b.y-a.y);
    return {pages:all};
  };

  const parseLubricantStructured = (structured,fileName='') => {
    const text=(structured.pages||[]).map(r=>r.text).join('\n');
    return parseLubricantBillLines(text,fileName);
  };
  const uploadLubricantBill = async e => {
    const file=e.target.files?.[0]; if(!file)return;
    if(!/^(application\/pdf|image\/(jpeg|png|webp))$/i.test(file.type)){setLubBillMsg('❌ केवल PDF/JPG/PNG/WEBP bill चुनें।');e.target.value='';return;}
    if(file.size>8*1024*1024){setLubBillMsg('❌ Bill file 8 MB से छोटी रखें।');e.target.value='';return;}
    setLubBillBusy(true);setLubBillMsg('⏳ HPCL Lubricant bill की पूरी table पढ़ी जा रही है...');
    try{
      let parsed;
      if(file.type==='application/pdf'){
        const structured=await extractLubricantPdf(file); parsed=parseLubricantStructured(structured,file.name);
      } else {
        // Image fallback: use Tesseract.js from CDN; OCR is only a fallback when PDF text is unavailable.
        if(!window.Tesseract){ await new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';sc.onload=resolve;sc.onerror=()=>reject(new Error('OCR library load failed'));document.head.appendChild(sc);}); }
        const out=await window.Tesseract.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text'&&m.progress>0)setLubBillMsg(`⏳ OCR ${Math.round(m.progress*100)}%...`);}});
        parsed=parseLubricantBillLines(out.data.text,file.name);
      }
      if(!parsed.items.length){setLubBillMsg('❌ Bill मिला लेकिन item table read नहीं हो सकी। यह bill image-scan हो तो PDF का clear original upload करें।');return;}
      const fileData=await readFileAsDataUrl(file);
      setLubBillPreview({...parsed,fileData,fileType:file.type,selected:true});
      setLubBillMsg(`✅ पूरा bill read हुआ: ${parsed.items.length} item lines · Inventory ${parsed.totalInventoryQty.toFixed(2)} L · Net ${money(parsed.totalNet)}. Save से पहले verify करें।`);
    }catch(err){console.error(err);setLubBillMsg(`❌ Bill reading error: ${err?.message||'unknown error'}`);}
    finally{setLubBillBusy(false);e.target.value='';}
  };

  const saveLubricantBill = async () => {
    if(!lubBillPreview) return;
    const r=lubBillPreview;
    try {
      if(!r.invoiceNo || !r.date || !Array.isArray(r.items) || r.items.length===0) return setLubBillMsg('❌ Invoice No, Bill Date और कम-से-कम एक item जरूरी है।');
      if(r.date<fy.start || r.date>fy.end) return setLubBillMsg(`❌ Bill Date ${r.date} selected Financial Year ${selectedFY} (${fy.start} to ${fy.end}) के बाहर है। Financial Year बदलकर फिर upload करें।`);
      const invoiceNo=String(r.invoiceNo).trim();
      const key=`LUBRICANT|${r.date}|${invoiceNo.toUpperCase()}`;
      if(purchases.some(x=>`LUBRICANT|${x.date}|${String(x.invoiceNo||'').trim().toUpperCase()}`===key)) return setLubBillMsg('❌ यह Lubricant invoice पहले से मौजूद है।');

      // A locked accounting month must never silently swallow an imported bill.
      const lockedMonths=new Set(Array.isArray(data?.accountingLocks?.months)?data.accountingLocks.months.map(String):[]);
      const billMonth=String(r.date).slice(0,7);
      if(lockedMonths.has(billMonth)) return setLubBillMsg(`🔒 ${billMonth} Accounting Month LOCKED है। पहले Accounting Period Unlock करें।`);

      const qty=n(r.totalInventoryQty), total=n(r.totalNet||((r.totalTaxable||0)+(r.totalTax||0))), tax=n(r.totalTax), basic=n(r.totalTaxable||r.totalBasic);
      if(!(qty>0)) return setLubBillMsg('❌ Invoice की Inventory Qty 0 है। Bill की Qty/Vol verify करें।');
      if(!(total>0)) return setLubBillMsg('❌ Invoice का Total/Net Amount 0 है। Bill amounts verify करें।');

      // Item-wise save invariant: every HPCL line must have a real description,
      // positive inventory quantity and positive line value; invoice totals must
      // reconcile to the parsed lines before the purchase can be saved.
      const badItem=r.items.find(x=>!String(x?.description||"").trim()||n(x?.inventoryQty)<=0||n(x?.netAmount)<0);
      if(badItem) return setLubBillMsg('❌ HPCL bill में invalid item line मिली। Item-wise save रोक दिया गया; original bill verify करें।');
      const lineQty=r.items.reduce((a,x)=>a+n(x?.inventoryQty),0);
      const lineNet=r.items.reduce((a,x)=>a+n(x?.netAmount),0);
      if(Math.abs(lineQty-qty)>0.01) return setLubBillMsg('❌ Item-wise Qty और invoice total Qty match नहीं हैं। Save रोक दिया गया।');
      if(Math.abs(lineNet-total)>0.05) return setLubBillMsg('❌ Item-wise Net Amount और invoice Net Amount match नहीं हैं। Save रोक दिया गया।');

      if(!window.confirm(`क्या HPCL Lubricant Purchase Invoice ${invoiceNo} को save करना है?\n\n${r.items.length} item lines\nInventory Qty: ${qty.toFixed(2)} L\nNet Amount: ${money(total)}`)) return setLubBillMsg('↩️ Save cancel किया गया। कोई data save नहीं हुआ।');

      const now=Date.now();
      const row={
        id:`LUB-PUR-${r.date}-${invoiceNo}`,
        transactionId:`PURCHASE-LUBRICANT-${r.date}-${invoiceNo}`,
        date:r.date, invoiceNo, fuel:'LUBRICANT',
        productName:r.items.map(x=>x.description).join(' | ').slice(0,500),
        supplier:String(r.supplier||'HINDUSTAN PETROLEUM CORP. LTD.').trim(), supplierGstin:String(r.gstin||'').trim(),
        quantity:qty, unit:'L', rate:qty>0?total/qty:0, basicAmount:basic, taxAmount:tax, totalAmount:total, amount:total,
        source:'HPCL-LUBRICANT-PDF', billFileName:r.fileName, billFileType:r.fileType, billFileData:r.fileData, uploadedAt:new Date().toISOString(),
        items:r.items.map(x=>({...x}))
      };
      // Sign the new row before handing it to the global integrity firewall.
      row.fingerprint=transactionFingerprint('PURCHASE',row);
      row.fingerprintVersion=2;

      const nextPurchases=[...(Array.isArray(data.purchases)?data.purchases:[]),row];
      const beforeScan=scanTransactionIntegrity(data);
      const candidate=normalizeIntegrityData({...data,purchases:nextPurchases});
      const afterScan=scanTransactionIntegrity(candidate);
      const sig=x=>`${x.type}|${x.collection||''}|${x.index??''}|${x.reason||''}`;
      const beforeErrors=new Set(beforeScan.errors.map(sig));
      const newErrors=afterScan.errors.filter(x=>!beforeErrors.has(sig(x)));
      if(newErrors.length){
        return setLubBillMsg(`❌ Save blocked by Data Integrity Firewall: ${newErrors.slice(0,3).map(x=>x.reason).join(' | ')}`);
      }

      // Wait for the central mutation gateway to accept the state change.
      // Never show SUCCESS merely because the handler reached this point.
      const result = await update({purchases:nextPurchases});
      if(!result?.ok){
        return setLubBillMsg(`❌ Lubricant Purchase save नहीं हुआ: ${result?.reason || 'Data mutation was rejected.'}`);
      }
      setLubBillPreview(null);
      setLubBillMsg(`✅ HPCL Lubricant Purchase ${invoiceNo} save हो गया। ${r.items.length} item lines · ${qty.toFixed(2)} L · ${money(total)}.`);
    } catch(err) {
      console.error('Lubricant purchase save failed',err);
      setLubBillMsg(`❌ Lubricant Purchase save नहीं हुआ: ${err?.message||'Unknown error'}`);
    }
  };

  // Legacy HPCL purchase recovery: re-read the bill attachment already stored on the
  // purchase row. This never invents product quantities. It only promotes successfully
  // parsed source invoice lines into items[] and then re-signs the purchase row.
  const reReadSavedHPCLBill=async(row)=>{
    setLubBillMsg("");
    if(!row) return;
    if(String(row?.source||"").toUpperCase()!=="HPCL-LUBRICANT-PDF") return setLubBillMsg("❌ यह HPCL Lubricant PDF purchase record नहीं है।");
    if(Array.isArray(row.items) && row.items.length) return setLubBillMsg("ℹ️ इस bill में item lines पहले से मौजूद हैं। कोई migration जरूरी नहीं।");
    if(!row.billFileData) return setLubBillMsg("❌ इस पुराने bill के साथ original attachment save नहीं है। इसे फिर से upload करना पड़ेगा; system अनुमान से item split नहीं करेगा।");
    setLubBillBusy(true);
    setLubBillMsg("⏳ Saved HPCL bill को दोबारा पढ़कर item lines recover की जा रही हैं...");
    try{
      const response=await fetch(row.billFileData);
      const buffer=await response.arrayBuffer();
      const type=String(row.billFileType||response.headers.get("content-type")||"application/pdf");
      const file=new File([buffer],String(row.billFileName||("HPCL-"+row.invoiceNo+".pdf")), {type});
      let parsed;
      if(/^application\/pdf$/i.test(type)){
        const structured=await extractLubricantPdf(file);
        parsed=parseLubricantStructured(structured,file.name);
      }else{
        if(!window.Tesseract){
          await new Promise((resolve,reject)=>{
            const sc=document.createElement("script");
            sc.src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
            sc.onload=resolve; sc.onerror=()=>reject(new Error("OCR library load failed"));
            document.head.appendChild(sc);
          });
        }
        const out=await window.Tesseract.recognize(file,"eng",{logger:m=>{
          if(m.status==="recognizing text"&&m.progress>0) setLubBillMsg("⏳ OCR "+Math.round(m.progress*100)+"%...");
        }});
        parsed=parseLubricantBillLines(out.data.text,file.name);
      }
      if(!parsed?.items?.length) return setLubBillMsg("❌ Saved bill पढ़ा गया, लेकिन item table recover नहीं हुई। कोई data change नहीं किया गया।");
      if(String(parsed.invoiceNo||"").trim().toUpperCase()!==String(row.invoiceNo||"").trim().toUpperCase()){
        return setLubBillMsg("❌ Re-read invoice number saved record से match नहीं करता। कोई data change नहीं किया गया।");
      }
      if(String(parsed.date||"")!==String(row.date||"")){
        return setLubBillMsg("❌ Re-read bill date saved record से match नहीं करती। कोई data change नहीं किया गया।");
      }
      const qty=n(parsed.totalInventoryQty), total=n(parsed.totalNet||((parsed.totalTaxable||0)+(parsed.totalTax||0)));
      if(!(qty>0)||!(total>0)) return setLubBillMsg("❌ Re-read से valid Qty/Net Amount नहीं मिला। कोई data change नहीं किया गया।");

      const updated={
        ...row,
        productName:parsed.items.map(x=>x.description).join(" | ").slice(0,500),
        quantity:qty,
        unit:"L",
        rate:qty>0?total/qty:0,
        basicAmount:n(parsed.totalTaxable||parsed.totalBasic),
        taxAmount:n(parsed.totalTax),
        totalAmount:total,
        amount:total,
        supplier:String(parsed.supplier||row.supplier||"HINDUSTAN PETROLEUM CORP. LTD.").trim(),
        supplierGstin:String(parsed.gstin||row.supplierGstin||"").trim(),
        items:parsed.items.map(x=>({...x})),
        source:"HPCL-LUBRICANT-PDF"
      };
      updated.fingerprint=transactionFingerprint("PURCHASE",updated);
      updated.fingerprintVersion=2;

      const nextPurchases=(Array.isArray(data.purchases)?data.purchases:[]).map(p=>String(p.id)===String(row.id)?updated:p);
      const beforeScan=scanTransactionIntegrity(data);
      const candidate=normalizeIntegrityData({...data,purchases:nextPurchases});
      const afterScan=scanTransactionIntegrity(candidate);
      const sig=x=>String(x.type||"")+"|"+String(x.collection||"")+"|"+String(x.index??"")+"|"+String(x.reason||"");
      const beforeErrors=new Set(beforeScan.errors.map(sig));
      const newErrors=afterScan.errors.filter(x=>!beforeErrors.has(sig(x)));
      if(newErrors.length) return setLubBillMsg("❌ Migration blocked by Data Integrity Firewall: "+newErrors.slice(0,3).map(x=>x.reason).join(" | "));

      const result=await update({purchases:nextPurchases});
      if(!result?.ok) return setLubBillMsg("❌ HPCL bill migration save नहीं हुआ: "+(result?.reason||"Mutation rejected"));
      setLubBillMsg("✅ HPCL bill recover हो गया: "+parsed.items.length+" item lines · "+qty.toFixed(2)+" L · "+money(total)+". अब Item Wise Stock में वास्तविक products दिखेंगे।");
    }catch(err){
      console.error("Saved HPCL bill re-read failed",err);
      setLubBillMsg("❌ Saved HPCL bill re-read failed: "+(err?.message||"Unknown error"));
    }finally{
      setLubBillBusy(false);
    }
  };

  const legacyHPCLPurchases=(Array.isArray(purchases)?purchases:[]).filter(p=>
    String(p?.source||"").toUpperCase()==="HPCL-LUBRICANT-PDF" &&
    !(Array.isArray(p?.items)&&p.items.length)
  );

  const bill = c => {
    if (!c || String(c.fuel || "").toUpperCase() !== "LUBRICANT") {
      alert("यह Sale Bill केवल Lubricant / Mobile Oil के लिए है।");
      return;
    }
    const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const gstRate=n(c.gstRate)>0?n(c.gstRate):18;
    const total=rupee(c.amount);
    const qty=n(c.qty);
    // Lubricant invoice only: GST-inclusive total. CGST and SGST are exactly equal to paise.
    const round2=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
    const halfGst=gstRate>0?round2(total*gstRate/(2*(100+gstRate))):0;
    const cgst=gstRate>0?halfGst:0;
    const sgst=gstRate>0?halfGst:0;
    const tax=round2(cgst+sgst);
    const taxable=round2(total-tax);
    const invoiceMoney=v=>"₹"+Number(v??0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
    const rate=qty>0?round2(total/qty):0;
    const amountInWords=(()=>{
      const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
      const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
      const two=x=>x<20?ones[x]:tens[Math.floor(x/10)]+(x%10?" "+ones[x%10]:"");
      const u=x=>{const h=Math.floor(x/100),r=x%100;return (h?ones[h]+" Hundred":"")+(h&&r?" ":"")+(r?two(r):"");};
      let x=Math.round(total); if(!x)return "Zero Rupees Only";
      const p=[],cr=Math.floor(x/10000000);x%=10000000;const la=Math.floor(x/100000);x%=100000;const th=Math.floor(x/1000);x%=1000;
      if(cr)p.push(u(cr)+" Crore"); if(la)p.push(u(la)+" Lakh"); if(th)p.push(u(th)+" Thousand"); if(x)p.push(u(x));
      return p.join(" ")+" Rupees Only";
    })();
    const invoiceNo=String(c.invoiceNo||"").trim();
    const challanNo=String(c.parchiNo||"").trim();
    const old=document.getElementById("stationmitra-lubricant-bill-overlay");
    if(old) old.remove();

    const overlay=document.createElement("div");
    overlay.id="stationmitra-lubricant-bill-overlay";
    overlay.innerHTML=`
      <style>
        #stationmitra-lubricant-bill-overlay{position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.65);overflow:auto;padding:12px;box-sizing:border-box}
        #stationmitra-lubricant-bill-overlay .bill-toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;padding:0 0 10px}
        #stationmitra-lubricant-bill-overlay button{padding:9px 16px;border:0;border-radius:6px;background:#111;color:#fff;font-weight:700;cursor:pointer}
        #stationmitra-lubricant-bill-overlay .bill-paper{background:#fff;color:#111;max-width:900px;margin:0 auto;padding:18px;box-sizing:border-box;font-family:Arial,sans-serif}
        #stationmitra-lubricant-bill-overlay .head{text-align:center;border-bottom:1px solid #111;padding-bottom:12px}
        #stationmitra-lubricant-bill-overlay .head h1{margin:4px 0;font-size:25px}
        #stationmitra-lubricant-bill-overlay .meta{display:grid;grid-template-columns:1fr 1fr}
        #stationmitra-lubricant-bill-overlay .meta>div{padding:10px;border-bottom:1px solid #111}
        #stationmitra-lubricant-bill-overlay .meta>div+div{border-left:1px solid #111}
        #stationmitra-lubricant-bill-overlay table{width:100%;border-collapse:collapse}
        #stationmitra-lubricant-bill-overlay th,#stationmitra-lubricant-bill-overlay td{border:1px solid #111;padding:8px}
        #stationmitra-lubricant-bill-overlay td.num{text-align:right}
        #stationmitra-lubricant-bill-overlay .bottom{display:grid;grid-template-columns:1fr 1fr}
        #stationmitra-lubricant-bill-overlay .bottom>div{padding:10px;min-height:130px}
        #stationmitra-lubricant-bill-overlay .bottom>div+div{border-left:1px solid #111}
        #stationmitra-lubricant-bill-overlay .terms{padding:10px;border-top:1px solid #111;font-size:10px}
        #stationmitra-lubricant-bill-overlay .sign{text-align:right;margin-top:28px;font-weight:bold}
        @media(max-width:700px){#stationmitra-lubricant-bill-overlay .meta,#stationmitra-lubricant-bill-overlay .bottom{grid-template-columns:1fr}#stationmitra-lubricant-bill-overlay .meta>div+div,#stationmitra-lubricant-bill-overlay .bottom>div+div{border-left:0}}
        @media print{
          body>*:not(#stationmitra-lubricant-bill-overlay){display:none!important}
          #stationmitra-lubricant-bill-overlay{position:static!important;background:#fff!important;padding:0!important;overflow:visible!important}
          #stationmitra-lubricant-bill-overlay .bill-toolbar{display:none!important}
          #stationmitra-lubricant-bill-overlay .bill-paper{max-width:none!important;margin:0!important;padding:0!important}
          @page{size:A4 portrait;margin:10mm}
        }
      </style>
      <div class="bill-toolbar">
        <button type="button" data-action="print">🖨️ Print / Save PDF</button>
        <button type="button" data-action="close">✕ Close Bill</button>
      </div>
      <div class="bill-paper">
        <div class="head"><div>ॐ श्री गुरुवे नमः:</div><b>GSTIN: 05ABWFS5610D1Z4 &nbsp; | &nbsp; State Code: 05</b><h1>SATAT FILLING STATION</h1><b>DEALER - HINDUSTAN PETROLEUM CORP. LTD.</b><div>Bye Pass Gaujajali (Bichli), HALDWANI-263139, Distt. Nainital (Uttarakhand)</div></div>
        <div class="meta"><div><b>M/s:</b> ${esc(c.party)}<br><b>Vehicle:</b> ${esc(c.vehicle||"")}</div><div><b>TAX INVOICE</b><br><b>Invoice No.:</b> ${esc(invoiceNo||"—")}<br><b>Challan No.:</b> ${esc(challanNo||"—")}<br><b>Date:</b> ${esc(c.date)}<br><b>Payment:</b> CREDIT / UDHARI</div></div>
        <table><thead><tr><th>Date</th><th>Challan No.</th><th>Vehicle No.</th><th>HSN</th><th>Product</th><th>Qty</th><th>Rate (GST Incl.)</th><th>Amount (GST Incl.)</th></tr></thead><tbody><tr><td>${esc(c.date)}</td><td>${esc(challanNo)}</td><td>${esc(c.vehicle||"")}</td><td>${esc(c.hsnCode||"")}</td><td>${esc(c.productName||"Mobile Oil (HPCL)")}</td><td class="num">${qty?qty.toFixed(2):"—"}</td><td class="num">${qty?money(rate):"—"}</td><td class="num">${invoiceMoney(total)}</td></tr></tbody></table>
        <div class="bottom"><div><b>Rupees in Words:</b><br>${esc(amountInWords)}</div><div><b>Assessable / Taxable Value:</b><span style="float:right">${invoiceMoney(taxable)}</span><br><b>Add: CGST (9%):</b><span style="float:right">${invoiceMoney(cgst)}</span><br><b>Add: SGST (9%):</b><span style="float:right">${invoiceMoney(sgst)}</span><br><b>Add: IGST:</b><span style="float:right">₹0.00</span><hr><b>Total Amount After Tax:</b><span style="float:right">${invoiceMoney(total)}</span></div></div>
        <div class="terms"><b>TERMS & CONDITIONS :-</b><br>• Once Goods Sold will not be taken back.<br>• All Jurisdiction Disputes will be settled at Haldwani Court.<br>• Interest 2% will be charged on all bills if not paid within 15 days.<div class="sign">For - SATAT FILLING STATION<br><br>Authorized Signatory</div></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="close"]').onclick=()=>overlay.remove();
    overlay.querySelector('[data-action="print"]').onclick=()=>window.print();
  };

  return <div className="content"><section className="panel" style={{marginBottom:12}}><div className="form"><label>Financial Year<select value={selectedFY} onChange={e=>setSelectedFY(e.target.value)}>{FINANCIAL_YEARS.map(y=><option key={y.value} value={y.value}>{y.label}</option>)}</select></label></div><div style={{marginTop:6,color:"#64748b"}}>Selected: {fy.start} to {fy.end}</div></section>
    <section className="panel"><h2>🛢️ Lubricant / Mobile Oil — Inventory & Reconciliation</h2>
      <div className="cards" style={{marginTop:12}}>
        <div className="card"><span>FY Opening Stock</span><strong>{openingQ.toFixed(2)} L</strong></div>
        <div className="card"><span>Previous FY Closing</span><strong>{n(calculatedPreviousClosing.qty).toFixed(2)} L</strong></div>
      </div>
      <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
        <button type="button" className="btn" onClick={carryForwardOpening}>↪️ Previous FY Closing → Carry Forward</button>
        <span style={{color:"#64748b",alignSelf:"center"}}>FY {selectedFY} का opening stock अलग रहेगा; 25-26 का closing 26-27 में opening बनेगा।</span>
      </div><p style={{marginTop:0,color:'#6b7280'}}>Mobile Oil (HPCL) को MS / HSD / CNG से अलग रखा गया है। Opening Stock अभी 0/blank रह सकता है और बाद में भरा जा सकता है।</p>
      <div className="grid"><section className="panel"><h3>Opening Stock — Optional</h3><div className="form"><Field label="Opening Qty"><input type="number" min="0" step="0.01" value={openingQty} onChange={e=>setOpeningQty(e.target.value)} placeholder="बाद में भरें" /></Field><Field label="Opening Value"><input type="number" min="0" step="0.01" value={openingValue} onChange={e=>setOpeningValue(e.target.value)} placeholder="बाद में भरें" /></Field></div><button className="btn" onClick={saveOpening}>💾 Save Lubricant Opening</button></section>
      <section className="panel"><h3>Current Reconciliation</h3><div className="cards" style={{gridTemplateColumns:'repeat(2,1fr)'}}><div className="card"><span>Opening</span><strong>{openingQ.toFixed(2)} L</strong><small>{money(openingV)}</small></div><div className="card"><span>Purchase</span><strong>{purchaseQ.toFixed(2)} L</strong><small>{money(purchaseV)}</small></div><div className="card"><span>Sale</span><strong>{saleQ.toFixed(2)} L</strong><small>{money(saleV)}</small></div><div className="card"><span>Closing Book Stock</span><strong>{closingQty.toFixed(2)} L</strong><small>Avg Cost {money(avgCost)}/L</small></div></div><div className={reconciliationStatus==='OK'?'success':'warning'} style={{marginTop:12}}><b>Status: {reconciliationStatus}</b>{qtyMissingSales>0&&<div>{qtyMissingSales} lubricant sale(s) में Qty नहीं है; amount accounting में है लेकिन physical stock reconciliation के लिए Qty बाद में भरनी होगी।</div>}</div></section></div>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <h3>📊 Lubricant Stock — Item Wise</h3>
      <p style={{marginTop:0,color:"#64748b"}}>हर HPCL product/SKU का stock अलग दिखेगा। Closing Qty = Opening + Purchase − Credit Sale − Cash Sale.</p>
      {lubricantStockItems.length===0 ? <div className="warning">अभी कोई Lubricant item नहीं मिला। HPCL purchase bill upload/save करने के बाद items यहाँ दिखाई देंगे।</div> :
      <div className="table" style={{overflowX:"auto"}}><table>
        <thead><tr><th>Item / Product</th><th>Opening Qty</th><th>Purchase Qty</th><th>Credit Sale</th><th>Cash Sale</th><th>Closing Qty</th><th>Avg Cost</th><th>Rounded Sale Price (GST Incl.)</th><th>Closing Value</th></tr></thead>
        <tbody>
          {lubricantItemLedger.map(item=><tr key={item.key}>
            <td><b>{item.name}</b>{item.hsn&&<small style={{display:"block",color:"#64748b"}}>HSN {item.hsn}</small>}</td>
            <td>{item.openingQty.toFixed(2)} L</td>
            <td>{item.purchaseQty.toFixed(2)} L</td>
            <td>{item.creditQty.toFixed(2)} L</td>
            <td>{item.cashQty.toFixed(2)} L</td>
            <td><b>{item.closingQty.toFixed(2)} L</b></td>
            <td>{money(item.avgCost)}/L</td>
            <td>
              {lubricantSalePriceOptions(item.name).length
                ? <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {lubricantSalePriceOptions(item.name).map(x=><span key={x.pack} style={{padding:"4px 7px",borderRadius:7,border:"1px solid #cbd5e1",background:"#f8fafc",fontSize:11}}>
                      <b>{x.pack}</b> · ₹{Number(x.price).toLocaleString("en-IN")}
                    </span>)}
                  </div>
                : "—"}
            </td>
            <td><b>{money(item.closingValue)}</b></td>
          </tr>)}
          <tr className="total-row">
            <td><b>ITEM-WISE TOTAL</b></td>
            <td><b>{lubricantItemLedger.reduce((a,x)=>a+x.openingQty,0).toFixed(2)} L</b></td>
            <td><b>{lubricantItemLedger.reduce((a,x)=>a+x.purchaseQty,0).toFixed(2)} L</b></td>
            <td><b>{lubricantItemLedger.reduce((a,x)=>a+x.creditQty,0).toFixed(2)} L</b></td>
            <td><b>{lubricantItemLedger.reduce((a,x)=>a+x.cashQty,0).toFixed(2)} L</b></td>
            <td><b>{lubricantItemLedger.reduce((a,x)=>a+x.closingQty,0).toFixed(2)} L</b></td>
            <td>—</td>
            <td>—</td>
            <td><b>{money(lubricantItemLedger.reduce((a,x)=>a+x.closingValue,0))}</b></td>
          </tr>
        </tbody>
      </table></div>}
    </section>

    {lubricantStockItems.length>0&&<section className="panel" style={{marginTop:18}}>
      <h3>🧮 Item-wise Opening Stock — FY {selectedFY}</h3>
      <p style={{marginTop:0,color:"#64748b"}}>यदि पुराने opening stock को product-wise मालूम है तो यहाँ item के अनुसार Qty और Value डालें। पुराना aggregate Opening ऊपर अलग रहेगा, इसलिए बिना allocation के item-wise closing में उसे शामिल नहीं किया जाएगा।</p>
      <div className="table" style={{overflowX:"auto"}}><table><thead><tr><th>Item</th><th>Opening Qty (L)</th><th>Opening Value (₹)</th></tr></thead><tbody>
        {lubricantStockItems.map(item=><tr key={item.key}>
          <td><b>{item.name}</b></td>
          <td><input type="number" min="0" step="0.01" value={itemOpeningDraft[item.key]?.qty??""} onChange={e=>setItemOpeningDraft(d=>({...d,[item.key]:{...(d[item.key]||{}),qty:e.target.value}}))}/></td>
          <td><input type="number" min="0" step="0.01" value={itemOpeningDraft[item.key]?.value??""} onChange={e=>setItemOpeningDraft(d=>({...d,[item.key]:{...(d[item.key]||{}),value:e.target.value}}))}/></td>
        </tr>)}
      </tbody></table></div>
      <div className="actions" style={{marginTop:10}}><button type="button" className="btn" onClick={saveItemWiseOpening}>💾 Save Item-wise Opening</button></div>
    </section>}
    {legacyHPCLPurchases.length>0&&<section className="panel" style={{marginTop:18,border:"2px solid #f59e0b"}}>
      <h3>⚠️ पुराने HPCL Bills — Item Lines Recover करें</h3>
      <p style={{marginTop:0,color:"#92400e"}}>
        इन पुराने HPCL purchase records में <b>items[] save नहीं हुई थी</b>। System इन्हें किसी product में अनुमान से नहीं बाँटेगा।
        Original saved bill attachment उपलब्ध हो तो उसे दोबारा पढ़कर वास्तविक item lines recover की जा सकती हैं।
      </p>
      {lubBillMsg&&<div className="warning" style={{marginBottom:10}}>{lubBillMsg}</div>}
      <div className="table" style={{overflowX:"auto"}}><table>
        <thead><tr><th>Date</th><th>Invoice No.</th><th>Current Qty</th><th>Attachment</th><th>Action</th></tr></thead>
        <tbody>{legacyHPCLPurchases.map(row=><tr key={String(row.id)}>
          <td>{row.date}</td><td>{row.invoiceNo||"—"}</td><td>{n(row.quantity).toFixed(2)} L</td>
          <td>{row.billFileData?<span>✅ Saved</span>:<span>❌ Not saved</span>}</td>
          <td><button type="button" className="btn" disabled={lubBillBusy||!row.billFileData} onClick={()=>reReadSavedHPCLBill(row)}>🔄 Re-read & Recover Items</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>}
    <section className="panel" style={{marginTop:18}}>
      <h3>📄 HPCL Lubricant Purchase Bill — Full Auto Reading</h3>
      <p style={{marginTop:0,color:'#6b7280'}}>पूरा HPCL invoice upload करें। एक invoice की सभी item lines, EA quantity, pack size, litre conversion, HSN, taxable value, IGST और net amount पढ़े जाएंगे।</p>
      <label className="btn" style={{display:'inline-block'}}>📤 Upload HPCL Lubricant Bill
        <input type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp" onChange={uploadLubricantBill} disabled={lubBillBusy} style={{display:'none'}} />
      </label>
      {lubBillBusy&&<div className="notice" style={{marginTop:12}}>⏳ पूरा bill पढ़ा जा रहा है… कृपया wait करें।</div>}
      {lubBillMsg&&<div className={lubBillMsg.startsWith('❌')?'warning':'success'} style={{marginTop:12}}>{lubBillMsg}</div>}
      {lubBillPreview&&<div className="panel" style={{marginTop:14,border:'2px solid #dbeafe'}}>
        <h4 style={{marginTop:0}}>🔎 Auto Read Preview — Verify Before Save</h4>
        <div className="cards" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="card"><span>Bill Date</span><strong>{lubBillPreview.date||'—'}</strong></div>
          <div className="card"><span>Invoice No.</span><strong>{lubBillPreview.invoiceNo||'—'}</strong></div>
          <div className="card"><span>Item Lines</span><strong>{lubBillPreview.items.length}</strong></div>
          <div className="card"><span>Inventory Qty</span><strong>{lubBillPreview.totalInventoryQty.toFixed(2)} L</strong></div>
        </div>
        <div className="table" style={{marginTop:12,overflowX:'auto'}}><table><thead><tr><th>#</th><th>Item Description</th><th>HSN</th><th>Billed Qty</th><th>Pack</th><th>Inventory L</th><th>Taxable</th><th>IGST</th><th>Net</th></tr></thead><tbody>{lubBillPreview.items.map((x,i)=><tr key={i}><td>{x.lineNo}</td><td>{x.description}</td><td>{x.hsn}</td><td>{x.billedQty} {x.unit}</td><td>{x.packSize||'—'}</td><td><b>{n(x.inventoryQty).toFixed(2)}</b></td><td>{money(x.taxableValue)}</td><td>{money(x.igstAmount)} ({x.igstRate}%)</td><td>{money(x.netAmount)}</td></tr>)}<tr className="total-row"><td colSpan="5"><b>TOTAL</b></td><td><b>{lubBillPreview.totalInventoryQty.toFixed(2)} L</b></td><td><b>{money(lubBillPreview.totalTaxable)}</b></td><td><b>{money(lubBillPreview.totalTax)}</b></td><td><b>{money(lubBillPreview.totalNet)}</b></td></tr></tbody></table></div>
        <p style={{fontSize:12,color:'#92400e',marginBottom:8}}>⚠️ Auto Reading suggestion है। Save करने से पहले invoice number, date, हर item, quantity और amounts verify करें।</p>
        <div className="actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="btn" onClick={saveLubricantBill}>🔐 Verify & Permission → Save</button><button type="button" className="btn" onClick={()=>{setLubBillPreview(null);setLubBillMsg('↩️ Preview हटाई गई। कुछ भी save नहीं हुआ।');}}>✖ Cancel</button></div>
      </div>}
    </section>

    <section className="panel" style={{marginTop:18}}><h3>{editingPurchaseId?'✏️ Edit Lubricant Purchase':'🧾 Add Lubricant Purchase'}</h3><div className="form"><Field label="Bill Date"><input type="date" value={purchase.date} onChange={e=>setPurchase({...purchase,date:e.target.value})}/></Field><Field label="Invoice No"><input value={purchase.invoiceNo} onChange={e=>setPurchase({...purchase,invoiceNo:e.target.value})}/></Field><Field label="Supplier"><input value={purchase.supplier} onChange={e=>setPurchase({...purchase,supplier:e.target.value})}/></Field><Field label="Product"><input value={purchase.productName} onChange={e=>setPurchase({...purchase,productName:e.target.value})}/></Field><Field label="Qty (L)"><input type="number" min="0" step="0.01" value={purchase.quantity} onChange={e=>setPurchase({...purchase,quantity:e.target.value})}/></Field><Field label="Bill Rate"><input type="number" min="0" step="0.01" value={purchase.rate} onChange={e=>setPurchase({...purchase,rate:e.target.value})}/></Field><Field label="Tax Amount"><input type="number" min="0" step="0.01" value={purchase.taxAmount} onChange={e=>setPurchase({...purchase,taxAmount:e.target.value})}/></Field><Field label="Total Amount"><input type="number" min="0" step="0.01" value={purchase.totalAmount} onChange={e=>setPurchase({...purchase,totalAmount:e.target.value})}/></Field><Field label="Bill Attachment (optional)"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf" onChange={e=>setPurchaseBillFile(e.target.files?.[0]||null)}/></Field></div>{editingPurchaseId&&(()=>{const current=(data.purchases||[]).find(x=>String(x.id)===String(editingPurchaseId)); return <div className="staff-note" style={{marginTop:10}}>{current?.billFileData?<><b>Current Bill:</b> {current.billFileName||"saved attachment"} · <button type="button" className="btn small" onClick={()=>openPurchaseBill(current.billFileData)}>📎 View Bill</button></>:<><b>Current Bill:</b> कोई attachment saved नहीं है। ऊपर Bill Attachment चुनकर Update करें।</>}</div>})()}<div className="actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn" onClick={addPurchase}>{editingPurchaseId?'💾 Update Lubricant Purchase':'➕ Save Lubricant Purchase'}</button>{editingPurchaseId&&<button type="button" className="btn" onClick={resetPurchaseForm}>✖ Cancel Edit</button>}</div>{msg&&<div className={msg.startsWith('❌')?'warning':'success'} style={{marginTop:10}}>{msg}</div>}</section>

    <section className="panel" style={{marginTop:18,border:'2px solid #16a34a'}}>
      <h3>💵 Lubricant Cash Sale — बिना पर्ची</h3>
      <p style={{marginTop:0,color:'#6b7280'}}>Cash sale में Parchi No., Party या Vehicle नहीं होगा। केवल Product, Qty, Rate और Amount दर्ज होगा। Payment हमेशा Cash रहेगा।</p>
      <div className="form">
        <Field label="Date"><input type="date" min={START_DATE} max={today} value={cashSale.date} onChange={e=>setCashSale({...cashSale,date:e.target.value})}/></Field>
        <Field label="Product (Uploaded Bill से Select करें)"><select value={cashSale.productName} onChange={e=>{const productName=e.target.value;const inferred=inferLubricantPackSizeLitres(productName);setCashSale(x=>({...x,productName,packSize:inferred||x.packSize,qty:n(x.packQty)>0&&inferred>0?rupee(n(x.packQty)*inferred):x.qty}));}}><option value="">Select Product</option>{cashSale.productName&&!lubricantProductOptions.some(x=>x.name===cashSale.productName)&&<option value={cashSale.productName}>{cashSale.productName}</option>}{lubricantProductOptions.map((x,i)=><option key={x.name+i} value={x.name}>{x.name}{x.hsn?" · HSN "+x.hsn:""}{x.invoiceNo?" · Inv "+x.invoiceNo:""}</option>)}</select><small style={{display:"block",marginTop:4,color:"#64748b"}}>Uploaded HPCL purchase bill के product में से चुनें।</small></Field>
        <Field label="Pack/Balti Qty"><input type="number" min="0" step="1" value={cashSale.packQty} onChange={e=>setCashSale({...cashSale,packQty:e.target.value,qty:n(e.target.value)>0&&n(cashSale.packSize)>0?rupee(n(e.target.value)*n(cashSale.packSize)):""})}/></Field><Field label="Pack Size (L)"><input type="number" min="0" step="0.01" value={cashSale.packSize} onChange={e=>setCashSale({...cashSale,packSize:e.target.value,qty:n(cashSale.packQty)>0&&n(e.target.value)>0?rupee(n(cashSale.packQty)*n(e.target.value)):cashSale.qty})} placeholder="जैसे 10"/></Field><Field label="Total Qty (L)"><input type="number" min="0" step="0.01" value={cashSale.qty} onChange={e=>setCashSale({...cashSale,qty:e.target.value})}/></Field>
        <Field label="Rate / L"><input type="number" min="0" step="0.01" value={cashSale.rate} onChange={e=>setCashSale(x=>({...x,rate:e.target.value}))}/></Field>
        <Field label="Amount (Auto)"><input type="number" min="0" step="0.01" value={(()=>{
          const autoQty=(n(cashSale.packQty)>0&&n(cashSale.packSize)>0)?rupee(n(cashSale.packQty)*n(cashSale.packSize)):n(cashSale.qty);
          return autoQty>0&&n(cashSale.rate)>0?rupee(autoQty*n(cashSale.rate)):"";
        })()} readOnly placeholder="Qty × Rate auto"/></Field>
        <Field label="Payment"><input value="CASH" readOnly/></Field>
      </div>
      <div className="actions"><button type="button" className="btn" onClick={saveCashSale}>{editingCashSaleId!==null?'💾 Update Cash Sale':'💵 Save Cash Sale'}</button>{editingCashSaleId!==null&&<button type="button" className="btn gray" onClick={resetCashSaleForm}>Cancel Edit</button>}</div>
    </section>

    {cashSales.length>0&&<section className="panel" style={{marginTop:18}}>
      <h3>💵 Lubricant Cash Sale Register</h3>
      <Table headers={['Date','Product','Qty','Rate','Amount','Payment']} rows={cashSales.map(x=>[x.date,x.productName||'Mobile Oil (HPCL)',n(x.qty).toFixed(2)+' L',money(x.rate),money(x.amount),'CASH'])} rowIds={cashSales.map(x=>x.id)} onEdit={id=>editCashSale(cashSales.find(x=>x.id===id))} onDelete={id=>deleteCashSale(cashSales.find(x=>x.id===id))}/>
    </section>}

    {editingSaleId!==null&&<section className="panel" style={{marginTop:18,border:'2px solid #f59e0b'}}><h3>✏️ Edit Lubricant Sale</h3><div className="form"><Field label="Date"><input type="date" min={START_DATE} max={today} value={editingSale.date} onChange={e=>setEditingSale({...editingSale,date:e.target.value})}/></Field><Field label="Parchi No."><input value={editingSale.parchiNo} onChange={e=>setEditingSale({...editingSale,parchiNo:e.target.value})}/></Field><Field label="Party"><select value={editingSale.party} onChange={e=>setEditingSale({...editingSale,party:e.target.value})}><option value="">Select</option>{(data.parties||[]).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}</select></Field><Field label="Vehicle"><input value={editingSale.vehicle} onChange={e=>setEditingSale({...editingSale,vehicle:e.target.value.toUpperCase()})}/></Field><Field label="Product (Uploaded Bill से Select करें)"><select value={editingSale.productName} onChange={e=>setEditingSale({...editingSale,productName:e.target.value})}><option value="">Select Product</option>{editingSale.productName&&!lubricantProductOptions.some(x=>x.name===editingSale.productName)&&<option value={editingSale.productName}>{editingSale.productName}</option>}{lubricantProductOptions.map((x,i)=><option key={x.name+i} value={x.name}>{x.name}{x.hsn?" · HSN "+x.hsn:""}{x.invoiceNo?" · Inv "+x.invoiceNo:""}</option>)}</select></Field><Field label="Qty (Optional)"><input type="number" min="0" step="0.01" value={editingSale.qty} onChange={e=>setEditingSale({...editingSale,qty:e.target.value})}/></Field><Field label="Amount"><input type="number" min="0" step="0.01" value={editingSale.amount} onChange={e=>setEditingSale({...editingSale,amount:e.target.value})}/></Field></div><div className="actions"><button type="button" className="btn" onClick={saveEditedSale}>💾 Update Lubricant Sale</button><button type="button" className="btn gray" onClick={resetSaleForm}>Cancel Edit</button></div></section>}
    <section className="panel" style={{marginTop:18}}><h3>💳 Lubricant Credit Sale Register — Mobile Oil (HPCL)</h3><Table headers={['Date','Parchi No.','Party','Vehicle','Product','Qty','Amount']} rows={sales.map(c=>[c.date,c.parchiNo,c.party,c.vehicle,c.productName||'Mobile Oil (HPCL)',n(c.qty)>0?`${n(c.qty).toFixed(2)} L`:'Qty pending',money(c.amount)])} rowIds={sales.map(c=>c.id||`${c.date}|${c.parchiNo}`)} onEdit={id=>editSale(sales.find(c=>c.id===id))} onPrintBill={id=>bill(sales.find(c=>c.id===id))} showPrintBill={id=>!!sales.find(c=>c.id===id)} onDelete={id=>deleteSale(sales.find(c=>c.id===id))} />{sales.length===0&&<div className="warning" style={{marginTop:10}}>अभी कोई Lubricant Credit Sale नहीं मिली। Credit Sale में Lubricant / Mobile Oil चुनकर entry save करें।</div>}</section>
    <section className="panel" style={{marginTop:18}}><h3>📦 Lubricant Purchase Register</h3><p style={{marginTop:0,color:"#64748b"}}>यहाँ <b>Bill Date</b> ही transaction date है। Bill upload होने की तारीख/समय (uploadedAt) इस register में कभी नहीं दिखेगा।</p><Table headers={["Bill Date","Invoice No.","Supplier","Items","Qty","Assessable","Tax","Total","Bill"]} rows={purchases.map(p=>[lubricantBillDate(p),p.invoiceNo,p.supplier||"Hindustan Petroleum Corp. Ltd.",Array.isArray(p.items)?p.items.length:1,`${n(p.quantity).toFixed(2)} L`,money(p.basicAmount),money(p.taxAmount),money(purchaseLandedValue(p)),p.billFileData?<button type="button" className="btn small" onClick={()=>openPurchaseBill(p.billFileData)}>📎 View Bill</button>:"—"])} rowIds={purchases.map(p=>p.id||`${p.date}|${p.invoiceNo}`)} onEdit={(id)=>editPurchase(purchases.find(p=>p.id===id))} onDelete={(id)=>deletePurchase(purchases.find(p=>p.id===id))} /></section>
  </div>;
}

/* =========================================================
   HPCL PURCHASE PDF IMPORT — FULL BILL FIELDS
   Keeps existing Fuel Sale untouched. Purchase is a separate dataset.
========================================================= */
let hpclPdfJsPromise2 = null;
export function loadHpclPdfJs2() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (hpclPdfJsPromise2) return hpclPdfJsPromise2;
  hpclPdfJsPromise2 = new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-pump-pro-pdfjs-full="1"]');
    if(existing){ existing.addEventListener('load',()=>resolve(window.pdfjsLib)); existing.addEventListener('error',reject); return; }
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async=true; script.dataset.pumpProPdfjsFull='1';
    script.onload=()=>{ try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';}catch{} resolve(window.pdfjsLib); };
    script.onerror=()=>reject(new Error('PDF reader load failed'));
    document.head.appendChild(script);
  });
  return hpclPdfJsPromise2;
}
async function hpclExtractPdfText2(file){
  const pdfjsLib=await loadHpclPdfJs2();
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buffer}).promise;
  const pages=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo);
    const content=await page.getTextContent();
    const items=content.items.filter(x=>String(x.str||'').trim()).map(x=>({text:String(x.str||'').trim(),x:Number(x.transform?.[4]||0),y:Number(x.transform?.[5]||0)})).sort((a,b)=>b.y-a.y||a.x-b.x);
    const lines=[];
    for(const item of items){
      let line=lines.find(l=>Math.abs(l.y-item.y)<=2.5);
      if(!line){line={y:item.y,items:[]};lines.push(line);}
      line.items.push(item);
    }
    pages.push(lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n');
}
export function hpclNum2(v){ const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m?Number(m[0]):0; }
export function hpclDate2(v){
  const x=String(v||'').trim().replace(/,/g,' ');
  let m=x.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  m=x.match(/\b(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{1,2})\s+(\d{4})\b/i);
  if(m){ const months={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12}; const key=m[1].slice(0,3).toUpperCase(); return `${m[3]}-${String(months[key]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`; }
  m=x.match(/\b(\d{1,2})\s+(JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?)\s+(\d{4})\b/i);
  if(m){ const months={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12}; const key=m[2].slice(0,3).toUpperCase(); return `${m[3]}-${String(months[key]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
  return '';
}
export function hpclFuel2(name,type,code){
  const s=`${name||''} ${type||''} ${code||''}`.toUpperCase();
  if(/CNG/.test(s)) return 'CNG';
  if(/HSD|DIESEL/.test(s)) return 'HSD';
  if(/MS|MOTOR SPIRIT|PETROL|GASOLINE/.test(s)) return 'MS';
  return '';
}
export function hpclParseInvoicePdfText2(text,fileName=''){
  const raw=String(text||'').replace(/\u00a0/g,' ');
  const lines=raw.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const joined=lines.join(' ');
  const invoiceMatch=joined.match(/INVOICE\s+No\s*:\s*([A-Z0-9-]+)/i)||joined.match(/INVOICE\s+NO\.?\s*([A-Z0-9-]+)/i);
  const dateMatch=joined.match(/\bDATE\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/i);
  const invoiceNo=String(invoiceMatch?.[1]||'').trim();
  const date=hpclDate2(dateMatch?.[1]||'');
  let billingDocNo='';
  const billingMatch=joined.match(/BILLING\s+DOC(?:UMENT)?\s*(?:NO)?\s*[:\-]?\s*([A-Z0-9-]+)/i);
  if(billingMatch) billingDocNo=billingMatch[1];
  const taxLines=[];
  let current=null;
  const productRe=/^\s*\d+\s+(.+?)\s+(\d{6,8})\s+([\d,]+(?:\.\d+)?)\s+(L|KG)\s+([\d,]+(?:\.\d+)?)\s+\/(KL|KG)\s+([\d,]+(?:\.\d+)?)\s*$/i;
  const products=[];
  for(const line of lines){
    const m=line.match(productRe);
    if(m){
      if(current) products.push(current);
      const productName=m[1].trim(), productCode=m[2], fuel=hpclFuel2(productName,'',productCode);
      current={invoiceNo,billingDocNo,date,productCode,productName,productType:'',fuel,quantity:hpclNum2(m[3]),unit:m[4]|| (fuel==='CNG'?'KG':'L'),rate:hpclNum2(m[5])/(String(m[6]).toUpperCase()==='KL'?1000:1),basicAmount:hpclNum2(m[7]),taxAmount:0,taxBreakdown:[],totalAmount:0,source:'HPCL-PDF',fileName};
      continue;
    }
    if(!current) continue;
    const tm=line.match(/^(CST(?:\s+with\s+Form)?|GST|IGST|CGST|SGST|State\s+Tax|IN\s+A\/R\s+VAT|SSLF\s+Recovery)\b.*?([\d,]+(?:\.\d+)?)\s*$/i);
    if(tm){
      const label=tm[1].replace(/\s+/g,' ').trim(), amount=hpclNum2(tm[2]);
      if(amount){ current.taxAmount += amount; current.taxBreakdown.push({label,amount}); }
    }
    const totalM=line.match(/(?:TOTAL\s+VALUE|TOTAL\s+AMOUNT)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)/i);
    if(totalM && current) current.totalAmount=hpclNum2(totalM[1]);
  }
  if(current) products.push(current);
  if(!products.length){
    const fallback=/(CNG\s*\([^\n]+?\)|HSD[^\n]+|MS[^\n]+?)\s+(\d{6,8})\s+([\d,]+(?:\.\d+)?)\s+(L|KG)\s+([\d,]+(?:\.\d+)?)\s+\/(KL|KG)\s+([\d,]+(?:\.\d+)?)/i.exec(raw);
    if(fallback){
      const productName=fallback[1].trim(), fuel=hpclFuel2(productName,'',fallback[2]);
      products.push({invoiceNo,billingDocNo,date,productCode:fallback[2],productName,productType:'',fuel,quantity:hpclNum2(fallback[3]),unit:fallback[4],rate:hpclNum2(fallback[5])/(String(fallback[6]).toUpperCase()==='KL'?1000:1),basicAmount:hpclNum2(fallback[7]),taxAmount:0,taxBreakdown:[],totalAmount:0,source:'HPCL-PDF',fileName});
    }
  }
  // HPCL single-product invoices commonly show tax lines followed by the invoice grand total.
  const grandMatch=joined.match(/(?:TOTAL\s+VALUE|TOTAL\s+AMOUNT)\s+([\d,]+(?:\.\d+)?)/i);
  const grand=grandMatch?hpclNum2(grandMatch[1]):0;
  return products.map(p=>{
    const assessable = n(p.basicAmount);
    const tax = n(p.taxAmount);
    const billTotal = n(p.totalAmount) || grand || (assessable + tax);
    // Purchase rate = (Total Assessable Value + Tax) / Ltr (MS/HSD) or Kg (CNG).
    // This is the landed purchase rate used by the Purchase section.
    const landedRate = p.quantity > 0
      ? ((assessable + tax) > 0 ? (assessable + tax) / p.quantity : billTotal / p.quantity)
      : 0;
    return {
      ...p,
      rate: landedRate,
      totalAmount: billTotal,
      amount: billTotal,
      taxAmount: tax,
      taxBreakdown:p.taxBreakdown||[]
    };
  }).filter(p=>p.fuel && p.quantity>0 && p.rate>0);
}

export function Purchase({data,update}){
  const [preview,setPreview]=useState([]), [msg,setMsg]=useState(''), [busy,setBusy]=useState(false);
  const [selectedFY,setSelectedFY]=useState(DEFAULT_FINANCIAL_YEAR);
  const fy=financialYearBounds(selectedFY);
  const [from,setFrom]=useState(fy.start), [to,setTo]=useState(todayDate()<fy.end?todayDate():fy.end);
  useEffect(()=>{setFrom(fy.start);setTo(todayDate()<fy.end?todayDate():fy.end);},[selectedFY]);
  const existing=Array.isArray(data.purchases)?data.purchases:[];
  const importPdf=async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true); setMsg('⏳ HPCL Purchase PDF पढ़ी जा रही है...');
    try{
      const text=await hpclExtractPdfText2(file);
      const rows=hpclParseInvoicePdfText2(text,file.name);
      if(!rows.length){setMsg('❌ PDF से purchase data नहीं मिला। Scanned/image PDF हो तो text-based HPCL PDF दें।');}
      else{
        const seen=new Set(existing.map(p=>purchaseBusinessKey(p)));
        const batchSeen=new Set();
        const checked=rows.map(r=>{
          const dateErr=assertPeriodDate(r.date,'Purchase Bill Date');
          const validFuel=['MS','HSD','CNG'].includes(String(r.fuel||''));
          const validQty=n(r.quantity)>0, validTotal=n(r.totalAmount||r.amount)>0;
          const key=purchaseBusinessKey(r);
          let status='READY';
          if(dateErr || !validFuel || !validQty || !validTotal) status='INVALID';
          else if(seen.has(key) || batchSeen.has(key)) status='DUPLICATE';
          batchSeen.add(key);
          return {...r,status,selected:status==='READY'};
        });
        setPreview(checked);
        const invalid=checked.filter(x=>x.status==='INVALID').length, dup=checked.filter(x=>x.status==='DUPLICATE').length;
        setMsg(`Preview में ${rows.length} row मिली। READY ${rows.length-invalid-dup} · DUPLICATE ${dup} · INVALID ${invalid}. Import से पहले सभी values verify करें।`);
      }
    }catch(err){console.error(err);setMsg('❌ PDF पढ़ने में error आया।');}
    finally{setBusy(false);e.target.value='';}
  };
  const importSelected=()=>{
    const rows=preview.filter(x=>x.selected&&x.status==='READY');
    if(!rows.length){setMsg('Import करने के लिए valid row select करें।');return;}
    const existingKeys=new Set(existing.map(p=>purchaseBusinessKey(p)));
    const batchKeys=new Set();
    const conflicts=rows.filter(r=>{const k=purchaseBusinessKey(r);const hit=existingKeys.has(k)||batchKeys.has(k);batchKeys.add(k);return hit;});
    if(conflicts.length){
      setMsg(`❌ Import रोक दिया गया: ${conflicts.length} duplicate/conflict row मिली। पहले Preview में duplicate rows हटाएँ.`);
      setPreview(p=>p.map(x=>conflicts.some(c=>c===x)?{...x,status:'DUPLICATE',selected:false}:x));
      return;
    }
    const records=rows.map(r=>({
      id:Date.now()+Math.random(), invoiceNo:r.invoiceNo,billingDocNo:r.billingDocNo,date:r.date,fuel:r.fuel,
      productName:r.productName,productCode:r.productCode,productType:r.productType,quantity:r.quantity,unit:r.unit,
      rate:r.rate,basicAmount:r.basicAmount,taxAmount:r.taxAmount,taxBreakdown:r.taxBreakdown,totalAmount:r.totalAmount||r.amount,
      amount:r.totalAmount||r.amount,supplyLocation:r.supplyLocation||'',salesOrder:r.salesOrder||'',vehicleNo:r.vehicleNo||'',source:'HPCL'
    }));
    update({purchases:[...existing,...records]}); setPreview([]); setMsg(`✅ ${records.length} purchase bill imported.`);
  };
  const filtered=existing.filter(p=>p.date>=from&&p.date<=to);
  const fuels=['MS','HSD','CNG'];
  const sumFuel=f=>filtered.filter(p=>p.fuel===f).reduce((a,p)=>({qty:a.qty+n(p.quantity),basic:a.basic+n(p.basicAmount),tax:a.tax+n(p.taxAmount),total:a.total+purchaseLandedValue(p)}),{qty:0,basic:0,tax:0,total:0});
  const purchaseRate=p=>purchaseEffectiveRate(p);
  const fuelEffectiveRate=f=>fuelPurchaseSummary(filtered,f).effectiveRate;

  // Fuel-wise Purchase Report actions — MS / HSD / CNG
  const purchaseReportEsc = v => String(v ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
  const purchaseReportRows = fuel => filtered
    .filter(p => String(p?.fuel || "").toUpperCase() === fuel)
    .slice()
    .sort((a,b) => String(b.date).localeCompare(String(a.date)));

  const purchasePrintFuel = fuel => {
    const rows = purchaseReportRows(fuel);
    const unit = fuel === "CNG" ? "Kg" : "L";
    const x = sumFuel(fuel);
    const body = rows.map(p => `<tr>
      <td>${purchaseReportEsc(p.date)}</td><td>${purchaseReportEsc(p.invoiceNo)}</td>
      <td>${n(p.quantity).toFixed(fuel==="CNG"?3:2)} ${unit}</td>
      <td>${money(p.rate)}</td><td>${money(purchaseRate(p))}</td>
      <td>${money(p.basicAmount ?? 0)}</td><td>${money(p.taxAmount ?? 0)}</td>
      <td>${money(purchaseLandedValue(p))}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) { alert("Print window blocked है. Chrome में Pop-ups and redirects → Allow करें, फिर Print / PDF दबाएँ।"); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${purchaseReportEsc(fuel)} Purchase Bills</title>
      <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1,h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #555;padding:7px;font-size:10px;text-align:right}th{background:#eee}th:first-child,td:first-child{text-align:left}.total{font-weight:800}.printbar{text-align:right;margin-bottom:12px}.printbtn{font-size:14px;padding:8px 16px;border:1px solid #555;border-radius:6px;background:#eee;cursor:pointer}@media print{.printbar{display:none}@page{size:A4 landscape;margin:10mm}}</style>
      </head><body><div class="printbar"><button class="printbtn" onclick="window.focus();window.print()">🖨️ Print / Save PDF</button></div>
      <h1>${purchaseReportEsc(PUMP_NAME)}</h1><h2>${fuel} — Purchase Bills</h2>
      <p>Period: ${purchaseReportEsc(from)} to ${purchaseReportEsc(to)}</p>
      <table><thead><tr><th>Bill Date</th><th>Invoice No</th><th>Qty</th><th>Bill Rate</th><th>Effective Rate</th><th>Assessable Value</th><th>Tax Amount</th><th>Total Amount</th></tr></thead>
      <tbody>${body || `<tr><td colspan="8">No ${fuel} purchase bills found.</td></tr>`}
      <tr class="total"><td colspan="2">TOTAL ${fuel}</td><td>${x.qty.toFixed(fuel==="CNG"?3:2)} ${unit}</td><td>—</td><td>${money(fuelEffectiveRate(fuel))}/${unit}</td><td>${money(x.basic)}</td><td>${money(x.tax)}</td><td>${money(x.total)}</td></tr>
      </tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>{try{window.focus();window.print();}catch(e){}},400));<\/script></body></html>`;
    try { w.document.open(); w.document.write(html); w.document.close(); w.focus(); }
    catch (err) { try { w.close(); } catch {} alert("Purchase Print / PDF खुल नहीं पाया।"); }
  };

  const purchaseExcelFuel = fuel => {
    const rows = purchaseReportRows(fuel);
    const unit = fuel === "CNG" ? "Kg" : "L";
    const x = sumFuel(fuel);
    const csvRows = [
      [PUMP_NAME],[`${fuel} — Purchase Bills`, `Period: ${from} to ${to}`],[],
      ["Bill Date","Invoice No","Qty","Unit","Bill Rate","Effective Rate","Assessable Value","Tax Amount","Total Amount"],
      ...rows.map(p => [p.date,p.invoiceNo,n(p.quantity),p.unit||unit,n(p.rate),n(purchaseRate(p)),n(p.basicAmount),n(p.taxAmount),n(purchaseLandedValue(p))]),
      [],["TOTAL",fuel,x.qty,unit,"",n(fuelEffectiveRate(fuel)),x.basic,x.tax,x.total]
    ];
    downloadCsv(`${fuel}_Purchase_Bills_${from}_to_${to}.csv`, csvRows);
  };

  const purchaseWhatsAppFuel = fuel => {
    const rows = purchaseReportRows(fuel);
    const unit = fuel === "CNG" ? "Kg" : "L";
    const x = sumFuel(fuel);
    const lines = [`*${PUMP_NAME}*`,`*${fuel} — Purchase Bills*`,`Period: ${from} to ${to}`,
      ...rows.map(p => `${p.date} | Invoice ${p.invoiceNo || "—"} | ${n(p.quantity).toFixed(fuel==="CNG"?3:2)} ${unit} | Effective ${money(purchaseRate(p))} | Total ${money(purchaseLandedValue(p))}`),
      `*TOTAL ${fuel}: ${x.qty.toFixed(fuel==="CNG"?3:2)} ${unit} | Assessable ${money(x.basic)} | Tax ${money(x.tax)} | Total ${money(x.total)} | Effective ${money(fuelEffectiveRate(fuel))}/${unit}*`];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  return <div className="content">
    <section className="panel"><h2>🧾 HPCL Purchase PDF Import</h2>
      <p>Bill का पूरा data save होगा: <b>Invoice No, Bill Date, Fuel, Ltr/Kg, Assessable Value, Tax Amount, Tax breakup, Total Amount और Purchase Rate</b>. Existing Fuel Sale में कोई बदलाव नहीं।</p>
      <p style={{marginTop:8,fontWeight:700}}>Purchase Value = HPCL Invoice Total Amount (fallback: Assessable Value + Tax Amount) · Effective Rate = Purchase Value ÷ actual billed Ltr/Kg. Bill Rate अलग है. यदि HPCL bill में Basic/Tax fields नहीं हैं, तो source Total Amount से Effective Rate निकलेगा.</p>
      <div className="actions" style={{marginTop:12}}><label className="btn">📄 Upload Purchase PDF<input type="file" accept="application/pdf,.pdf" onChange={importPdf} style={{display:'none'}} disabled={busy}/></label><button className="btn" onClick={importSelected}>✅ Import Selected</button></div>
      {busy&&<div className="notice" style={{marginTop:12}}>PDF processing…</div>}{msg&&<div className="success" style={{marginTop:12}}>{msg}</div>}
    </section>
    {preview.length>0&&<section className="panel" style={{marginTop:18}}><h3>HPCL Bill Preview</h3><div className="table"><table><thead><tr><th>✓</th><th>Bill Date</th><th>Invoice No</th><th>Fuel</th><th>Qty</th><th>Bill Rate</th><th>Effective Rate</th><th>Assessable</th><th>Tax</th><th>Total</th><th>Status</th></tr></thead><tbody>{preview.map((r,i)=><tr key={i}><td><input type="checkbox" checked={!!r.selected} disabled={r.status!=='READY'} onChange={e=>setPreview(p=>p.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/></td><td>{r.date}</td><td>{r.invoiceNo}</td><td>{r.fuel}</td><td>{n(r.quantity).toFixed(r.fuel==='CNG'?3:2)} {r.unit}</td><td>{money(r.rate)}</td><td><b>{money(purchaseRate(r))}</b></td><td>{money(r.basicAmount)}</td><td>{money(r.taxAmount)}</td><td>{money(purchaseLandedValue(r))}</td><td>{r.status}</td></tr>)}</tbody></table></div></section>}
    <section className="panel" style={{marginTop:18}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><h3>📚 Purchase Bill Register — Fuel-wise</h3><p style={{margin:0}}>हर bill MS, HSD और CNG में अलग-अलग दिखेगा।</p></div><div style={{display:'flex',gap:10}}><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div></div>
      <div className="panel" style={{marginTop:14,border:'1px solid #cbd5e1',background:'#f8fafc'}}>
        <b>🔗 Purchase → Receipt / Tank Filling → Stock</b>
        <div style={{fontSize:12,marginTop:6}}>MS/HSD में अब हर नई Tank Filling को एक HPCL Purchase Bill से link करना जरूरी है। एक bill की quantity कई fillings में split हो सकती है, लेकिन linked quantity bill quantity से ज्यादा नहीं हो सकती। पुराने exact date+fuel+qty records को system ने automatically link किया है। CNG इस physical stock chain से बाहर है.</div>
        <div className="cards" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:10}}>{fuels.map(f=>{
          const purchaseQ=sumFuel(f).qty;
          const fillingQ=f==='CNG'?null:(data.fillings||[]).filter(x=>x.fuel===f&&x.date>=from&&x.date<=to).reduce((a,x)=>a+n(x.qty),0);
          const linkedQ=f==='CNG'?0:(data.fillings||[]).filter(x=>x.fuel===f&&x.date>=from&&x.date<=to&&x.purchaseRef).reduce((a,x)=>a+n(x.qty),0);
          const unlinkedQ=f==='CNG'?0:fillingQ-linkedQ;
          return <div className="card" key={`recon-${f}`}><span>{f} Purchase / Receipt</span><strong>{f==='CNG'?'N/A':`${(purchaseQ-linkedQ).toFixed(2)} L unreceived`}</strong><small>Purchase {purchaseQ.toFixed(f==='CNG'?3:2)} {f==='CNG'?'Kg':'L'} · Linked Receipt {f==='CNG'?'N/A':linkedQ.toFixed(2)+' L'} · Legacy/Unlinked Filling {f==='CNG'?'N/A':unlinkedQ.toFixed(2)+' L'}</small></div>
        })}</div>
      </div>
      <div className="cards" style={{gridTemplateColumns:'repeat(3,1fr)'}}>{fuels.map(f=>{const x=sumFuel(f);const avg=fuelEffectiveRate(f);return <div className="card" key={f}><span>{f} Purchase</span><strong>{x.qty.toFixed(f==='CNG'?3:2)} {f==='CNG'?'Kg':'L'}</strong><small>Assessable {money(x.basic)} · Tax {money(x.tax)} · Total {money(x.total)} · Rate {money(avg)}/{f==='CNG'?'Kg':'L'}</small></div>})}</div>
      {fuels.map(f=>{const rows=filtered.filter(p=>p.fuel===f).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));const x=sumFuel(f);const unit=f==='CNG'?'Kg':'L';return <section className="panel" key={f} style={{marginTop:16,border:'2px solid #dbeafe'}}><h3>{f} — Purchase Bills</h3><div className="actions" style={{display:"flex",gap:8,flexWrap:"wrap",margin:"10px 0 12px"}}><button type="button" className="btn" onClick={()=>purchasePrintFuel(f)}>🖨️ Print / PDF</button><button type="button" className="btn" onClick={()=>purchaseExcelFuel(f)}>📊 Excel</button><button type="button" className="btn" onClick={()=>purchaseWhatsAppFuel(f)}>💬 WhatsApp</button></div><Table headers={['Bill Date','Invoice No','Qty',`Bill Rate / ${unit}`,`Effective Rate / ${unit}`,'Assessable Value','Tax Amount','Total Amount']} rows={rows.map(p=>[p.date,p.invoiceNo,`${n(p.quantity).toFixed(f==='CNG'?3:2)} ${p.unit||unit}`,money(p.rate),<b>{money(purchaseRate(p))}</b>,money(p.basicAmount??0),money(p.taxAmount),money(purchaseLandedValue(p))])} rowIds={rows.map(p=>p.id||`${p.date}|${p.invoiceNo}|${p.fuel}`)} onDelete={id=>update({purchases:existing.filter(p=>(p.id||`${p.date}|${p.invoiceNo}|${p.fuel}`)!==id)})}/><div style={{marginTop:10,fontWeight:700}}>Total {f}: {x.qty.toFixed(f==='CNG'?3:2)} {unit} · Assessable {money(x.basic)} · Tax {money(x.tax)} · Total {money(x.total)} · Effective Rate {money(fuelEffectiveRate(f))}/{unit}</div></section>})}
    </section>
  </div>;
}

export function SalePurchaseProfitLoss({ data }) {
  const [selectedFY,setSelectedFY]=useState(DEFAULT_FINANCIAL_YEAR);
  const fy=financialYearBounds(selectedFY);
  const [from,setFrom]=useState(fy.start);
  const [to,setTo]=useState(todayISODate()<fy.end?todayISODate():fy.end);
  useEffect(()=>{setFrom(fy.start);setTo(todayISODate()<fy.end?todayISODate():fy.end);},[selectedFY]);
  const sales=authoritativeSalesRows(data);
  const purchases=Array.isArray(data?.purchases)?data.purchases:[];
  const dailyPayments=Array.isArray(data?.dailyPayments)?data.dailyPayments:[];
  const fuelList=['MS','HSD','CNG','LUBRICANT'];
  const fallbackRate={MS:n(data?.rates?.MS??99.79),HSD:n(data?.rates?.HSD??95.32),CNG:n(data?.rates?.CNG??101),LUBRICANT:(n(data?.openingStock?.LUBRICANT_QTY)>0?n(data?.openingStock?.LUBRICANT_VALUE)/n(data?.openingStock?.LUBRICANT_QTY):0)};

  const dateBefore=(a,b)=>String(a).localeCompare(String(b))<0;
  const purchaseQty=(fuel,endDate=null)=>purchases.filter(p=>p.fuel===fuel&&(!endDate||dateBefore(p.date,endDate))).reduce((a,p)=>a+n(p.quantity),0);
  // Purchase Value = Assessable/Basic Value + Purchase Tax = invoice Total Amount.
  // This full landed purchase value (including tax) is used for stock valuation and COGS.
  const purchaseCost=(fuel,endDate=null)=>purchases.filter(p=>p.fuel===fuel&&(!endDate||dateBefore(p.date,endDate))).reduce((a,p)=>a+purchaseLandedValue(p),0);
  const saleQtyBefore=(fuel,endDate)=>fuel==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(s=>String(s?.fuel||'').toUpperCase()===fuel&&dateBefore(s.date,endDate)).reduce((a,s)=>a+n(s.qty),0):sales.filter(s=>s.fuel===fuel&&dateBefore(s.date,endDate)).reduce((a,s)=>a+n(s.qty),0);
  // Book opening quantity for the selected period. MS/HSD use the configured opening
  // stock. CNG does not have a physical stock opening/closing field in the current data
  // model (its recorded opening/closing values are dispenser totalizer readings), so
  // CNG stock balance is intentionally not invented from those meter readings.
  const openingQtyFor=(fuel,date)=>{
    if(fuel==='CNG') return null;
    const base=fuel==='MS'?n(data?.openingStock?.MS??9356):fuel==='HSD'?n(data?.openingStock?.HSD??7500):n(data?.openingStock?.LUBRICANT_QTY);
    if(String(date)===String(START_DATE)) return base;
    return base + purchaseQty(fuel,date) - saleQtyBefore(fuel,date);
  };

  // Opening stock value is carried at the latest known purchase total cost rate before the
  // selected period. If no earlier purchase exists, use the configured fuel rate.
  const openingRateFor=(fuel,date)=>{
    const prior=purchases.filter(p=>p.fuel===fuel&&dateBefore(p.date,date));
    if(prior.length){
      const q=prior.reduce((a,p)=>a+n(p.quantity),0);
      const b=prior.reduce((a,p)=>a+purchaseLandedValue(p),0);
      if(q>0) return b/q;
    }
    return fallbackRate[fuel]||0;
  };

  const validPeriod=!!from&&!!to&&from<=to&&!!assertPeriodDate(from,'From Date')===false&&!!assertPeriodDate(to,'To Date')===false;
  const filteredSales=validPeriod?sales.filter(s=>s.date>=from&&s.date<=to):[];
  const filteredPurchases=validPeriod?purchases.filter(p=>p.date>=from&&p.date<=to):[];
  const staff=Array.isArray(data?.staff)?data.staff:[];

  // Salary expense is based on the saved monthly salary of each staff member.
  // For a complete month (e.g. 01-08-2026 to 31-08-2026) the full monthly salary
  // is charged. If the selected period covers only part of a month, that month's
  // salary is prorated by calendar days; attendance is not used to silently deduct salary.
  const salaryExpenseForPeriod=useMemo(()=>{
    if(!from||!to||from>to) return 0;
    const monthSet=new Set();
    let cur=new Date(`${from}T12:00:00`);
    const end=new Date(`${to}T12:00:00`);
    while(cur<=end){
      monthSet.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`);
      cur.setMonth(cur.getMonth()+1);
    }
    let total=0;
    for(const month of monthSet){
      const [yy,mm]=month.split('-').map(Number);
      const daysInMonth=new Date(yy,mm,0).getDate();
      const monthStart=`${month}-01`;
      const monthEnd=`${month}-${String(daysInMonth).padStart(2,'0')}`;
      const activeStart=from>monthStart?from:monthStart;
      const activeEnd=to<monthEnd?to:monthEnd;
      const days=Math.max(0,Math.round((new Date(`${activeEnd}T12:00:00`)-new Date(`${activeStart}T12:00:00`))/86400000)+1);
      total += staff.reduce((sum,person)=>sum + (n(person.salary) * days / daysInMonth),0);
    }
    return total;
  },[from,to,staff]);

  // Electricity expense comes from saved bills, never from a hard-coded amount.
  const electricityExpenseForPeriod = (Array.isArray(data?.electricityBills) ? data.electricityBills : [])
    .filter(b => { const m = String(b?.month || ''); return m >= String(from).slice(0,7) && m <= String(to).slice(0,7); })
    .reduce((sum, b) => sum + n(b?.amount), 0);

  /* CNG: no physical stock. Vehicle/trailer CNG is sold first and the purchase
     bill can be generated later. Match purchase bills to earlier sales FIFO. */
  const cngSalePurchaseMatching=useMemo(()=>{
    const cngSales=sales.filter(s=>s.fuel==='CNG'&&s.date>=START_DATE).slice().sort((a,b)=>{
      const d=String(a.date).localeCompare(String(b.date));
      return d || String(a.transactionId??a.id??'').localeCompare(String(b.transactionId??b.id??''));
    });
    const cngPurchases=purchases.filter(p=>p.fuel==='CNG'&&p.date>=START_DATE).slice().sort((a,b)=>{
      const d=String(a.date).localeCompare(String(b.date));
      return d || String(a.transactionId??a.id??'').localeCompare(String(b.transactionId??b.id??''));
    });
    const remainingSales=cngSales.map(s=>({sale:s,remaining:Math.max(0,n(s.qty)),matchedQty:0,matchedCost:0}));
    const billMatches=[];
    cngPurchases.forEach(p=>{
      let remainingPurchase=Math.max(0,n(p.quantity));
      const unitCost=n(p.quantity)>0?purchaseEffectiveRate(p):0;
      let matchedCost=0, matchedQty=0;
      for(const item of remainingSales){
        if(remainingPurchase<=0) break;
        /* CNG business rule: sale is recorded first and the purchase bill may
           be entered later. For the selected accounting pool, do not reject a
           sale merely because its date is after/before the bill date; match the
           available CNG bill quantity FIFO against the recorded CNG sales. */
        if(item.remaining<=0) continue;
        const q=Math.min(remainingPurchase,item.remaining);
        item.remaining-=q; item.matchedQty+=q; item.matchedCost+=q*unitCost;
        remainingPurchase-=q; matchedQty+=q; matchedCost+=q*unitCost;
      }
      billMatches.push({purchaseId:p.id??`${p.date}|${p.invoiceNo}|CNG`,date:p.date,invoiceNo:p.invoiceNo||'—',qty:n(p.quantity),unitCost,matchedQty,matchedCost,unmatchedQty:Math.max(0,n(p.quantity)-matchedQty)});
    });
    const selected=remainingSales.filter(x=>x.sale.date>=from&&x.sale.date<=to);
    const selectedBillMatches=billMatches.filter(x=>String(x.date)>=String(from)&&String(x.date)<=String(to));
    const matchedQty=selected.reduce((a,x)=>a+x.matchedQty,0);
    const matchedCost=selected.reduce((a,x)=>a+x.matchedCost,0);
    const saleQty=selected.reduce((a,x)=>a+n(x.sale.qty),0);
    const unmatchedQty=selected.reduce((a,x)=>a+x.remaining,0);
    const unmatchedAmount=selected.reduce((a,x)=>a+(x.remaining>0?(n(x.sale.amount)*x.remaining/Math.max(1,n(x.sale.qty))):0),0);
    // Display-only reconciliation: exposes purchase bill quantity/cost that
    // remains unapplied after the existing FIFO allocation. No COGS logic changes.
    const unmatchedPurchaseQty=selectedBillMatches.reduce((a,x)=>a+n(x.unmatchedQty),0);
    const unmatchedPurchaseCost=selectedBillMatches.reduce((a,x)=>a+n(x.unmatchedQty)*n(x.unitCost),0);
    const matchedPurchaseOutsidePeriod = selected.reduce((a,x)=>a+x.matchedQty,0) - selectedBillMatches.reduce((a,b)=>a+b.matchedQty,0);
    return {saleQty,matchedQty,matchedCost,unmatchedQty,unmatchedAmount,unmatchedPurchaseQty,unmatchedPurchaseCost,matchedPurchaseOutsidePeriod,billMatches,selected,selectedBillMatches};
  },[sales,purchases,from,to]);

  const calc=useMemo(()=>{
    const out={};
    fuelList.forEach(f=>{
      const openingQty=openingQtyFor(f,from);
      const purchaseQtyInPeriod=filteredPurchases.filter(p=>p.fuel===f).reduce((a,p)=>a+n(p.quantity),0);
      const purchaseCostInPeriod=filteredPurchases.filter(p=>p.fuel===f).reduce((a,p)=>a+purchaseLandedValue(p),0);
      const saleQtyInPeriod=f==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(s=>String(s?.fuel||'').toUpperCase()===f&&s.date>=from&&s.date<=to).reduce((a,s)=>a+n(s.qty),0):filteredSales.filter(s=>s.fuel===f).reduce((a,s)=>a+n(s.qty),0);
      const saleAmount=f==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(s=>String(s?.fuel||'').toUpperCase()===f&&s.date>=from&&s.date<=to).reduce((a,s)=>a+n(s.amount),0):filteredSales.filter(s=>s.fuel===f).reduce((a,s)=>a+n(s.amount),0);
      const expense=dailyPayments.filter(p=>String(p.date)>=String(from)&&String(p.date)<=String(to)).reduce((a,p)=>a+n(p?.[f]?.pumpExpense)+(p?.[f]?.pumpExpense===undefined?n(p?.[f]?.other):0),0);
      const openingRate=openingRateFor(f,from);
      const cngStateTaxRate = Number.isFinite(Number(data?.cngStateTaxRate)) ? Number(data.cngStateTaxRate) : 0.05;
      const stateTax=f==='CNG'?saleAmount*cngStateTaxRate:0;
      let closingQty=null, openingValue=0, closingValue=0, cogs=0, avgCostRate=openingRate;
      let matchedPurchaseQty=0, matchedPurchaseCost=0, unmatchedSaleQty=0, unmatchedSaleAmount=0, unmatchedPurchaseQty=0, unmatchedPurchaseCost=0;
      if(f!=='CNG'){
        closingQty=openingQty+purchaseQtyInPeriod-saleQtyInPeriod;
        openingValue=openingQty*openingRate;
        const goodsAvailableValue=openingValue+purchaseCostInPeriod;
        const availableQty=openingQty+purchaseQtyInPeriod;
        avgCostRate=availableQty>0?goodsAvailableValue/availableQty:openingRate;
        closingValue=closingQty*avgCostRate;
        cogs=Math.max(0,openingValue+purchaseCostInPeriod-closingValue);
      } else {
        matchedPurchaseQty=cngSalePurchaseMatching.matchedQty;
        matchedPurchaseCost=cngSalePurchaseMatching.matchedCost;
        unmatchedSaleQty=cngSalePurchaseMatching.unmatchedQty;
        unmatchedSaleAmount=cngSalePurchaseMatching.unmatchedAmount;
        unmatchedPurchaseQty=cngSalePurchaseMatching.unmatchedPurchaseQty;
        unmatchedPurchaseCost=cngSalePurchaseMatching.unmatchedPurchaseCost;
        cogs=matchedPurchaseCost;
        avgCostRate=matchedPurchaseQty>0?matchedPurchaseCost/matchedPurchaseQty:0;
      }
      const profit=saleAmount-cogs-expense-stateTax;
      out[f]={openingQty,purchaseQty:purchaseQtyInPeriod,saleQty:saleQtyInPeriod,closingQty,openingValue,purchaseCost:purchaseCostInPeriod,closingValue,cogs,sale:saleAmount,expense,stateTax,profit,avgCostRate,matchedPurchaseQty,matchedPurchaseCost,unmatchedSaleQty,unmatchedSaleAmount,unmatchedPurchaseQty,unmatchedPurchaseCost};
    });
    out.total=fuelList.reduce((a,f)=>{Object.keys(out[f]).forEach(k=>{if(typeof out[f][k]==='number')a[k]=(a[k]||0)+out[f][k];});return a;},{});
    return out;
  },[from,to,filteredSales,filteredPurchases,dailyPayments,data?.openingStock,data?.rates,cngSalePurchaseMatching]);

  const displayPurchaseCostTotal=(calcMS,calcHSD,calcCNG,calcLube)=>n(calcMS.purchaseCost)+n(calcHSD.purchaseCost)+n(calcCNG.matchedPurchaseCost)+n(calcLube?.purchaseCost);
  // Explicit MS + HSD purchase total from actual invoice totals in the selected period.
  // Never derive this figure from sales quantity or fixed fuel rates.
  const actualMSPurchaseTotal=filteredPurchases.filter(p=>String(p?.fuel||'').toUpperCase()==='MS').reduce((a,p)=>a+n(p?.totalAmount??p?.amount??0),0);
  const actualHSDPurchaseTotal=filteredPurchases.filter(p=>String(p?.fuel||'').toUpperCase()==='HSD').reduce((a,p)=>a+n(p?.totalAmount??p?.amount??0),0);
  const actualMSHSDPurchaseTotal=actualMSPurchaseTotal+actualHSDPurchaseTotal;

  const qtyText=(q,f)=>q==null?'—':`${n(q).toFixed(f==='CNG'?3:2)} ${f==='CNG'?'Kg':'L'}`;
  const exportExcel=()=>{
    const rows=[
      ['SALE / PURCHASE P&L',`${from} to ${to}`],
      ['Fuel','Opening Balance','Purchase','Sale','Closing Balance','Opening Value','Purchase Value','Closing Value','COGS','Sale Amount','Expense','State Tax','Profit','CNG Matched Purchase Qty','CNG Matched Cost','CNG Unmatched Sale Qty','CNG Unmatched Purchase Qty','CNG Unmatched Purchase Cost'],
      ...fuelList.map(f=>[f,f==='CNG'?'N/A':calc[f].openingQty,f==='CNG'?'Bill Qty':calc[f].purchaseQty,calc[f].saleQty,f==='CNG'?'N/A':calc[f].closingQty,f==='CNG'?'N/A':calc[f].openingValue,f==='CNG'?calc[f].matchedPurchaseCost:calc[f].purchaseCost,f==='CNG'?'N/A':calc[f].closingValue,calc[f].cogs,calc[f].sale,calc[f].expense,calc[f].stateTax,calc[f].profit,f==='CNG'?calc[f].matchedPurchaseQty:'',f==='CNG'?calc[f].matchedPurchaseCost:'',f==='CNG'?calc[f].unmatchedSaleQty:'',f==='CNG'?calc[f].unmatchedPurchaseQty:'',f==='CNG'?calc[f].unmatchedPurchaseCost:'']),
      ['TOTAL',calc.total.openingQty,calc.total.purchaseQty,calc.total.saleQty,calc.total.closingQty,calc.total.openingValue,displayPurchaseCostTotal(calc.MS,calc.HSD,calc.CNG,calc.LUBRICANT),calc.total.closingValue,calc.total.cogs,calc.total.sale,calc.total.expense,calc.total.stateTax,calc.total.profit,'','',''],
      [],
      ['SALARY EXPENSE',salaryExpenseForPeriod],
      ['ELECTRICITY EXPENSE',electricityExpenseForPeriod],
      ['FINAL NET PROFIT',calc.total.profit-salaryExpenseForPeriod-electricityExpenseForPeriod]
    ];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Sale_Purchase_PL_${from}_to_${to}.csv`;a.click();URL.revokeObjectURL(url);
  };

  const printReport=()=>{
    const body=fuelList.map(f=>`<tr><td>${f}</td><td>${f==='CNG'?'N/A':qtyText(calc[f].openingQty,f)}</td><td>${qtyText(calc[f].purchaseQty,f)}</td><td>${qtyText(calc[f].saleQty,f)}</td><td>${f==='CNG'?'N/A':qtyText(calc[f].closingQty,f)}</td><td>${f==='CNG'?'N/A':money(calc[f].openingValue)}</td><td>${f==='CNG'?money(calc[f].matchedPurchaseCost):money(calc[f].purchaseCost)}</td><td>${f==='CNG'?'N/A':money(calc[f].closingValue)}</td><td>${money(calc[f].cogs)}</td><td>${money(calc[f].sale)}</td><td>${money(calc[f].expense)}</td><td>${money(calc[f].stateTax)}</td><td>${money(calc[f].profit)}</td></tr>`).join('');
    const w=window.open('', '_blank');
    if(!w){alert('Print window blocked है. Chrome में Pop-ups and redirects → Allow करें, फिर Print / PDF दबाएँ।');return;}
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Sale Purchase P&L</title><style>body{font-family:Arial;padding:20px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:7px;text-align:right}th:first-child,td:first-child{text-align:left}.summary{margin-top:18px;border:1px solid #999;padding:12px}.final{font-size:16px;font-weight:bold}.printbar{text-align:right;margin-bottom:12px}.printbtn{font-size:14px;padding:8px 16px;border:1px solid #555;border-radius:6px;background:#eee;cursor:pointer}@media print{.printbar{display:none}@page{size:A4 landscape;margin:10mm}}</style></head><body><div class="printbar"><button class="printbtn" onclick="window.focus();window.print()">🖨️ Print / Save PDF</button></div><h2>${PUMP_NAME}</h2><h3>Sale ↔ Purchase P&L</h3><p>${esc(from)} to ${esc(to)}</p><table><tr><th>Fuel</th><th>Opening</th><th>Purchase</th><th>Sale</th><th>Closing</th><th>Opening Value</th><th>Purchase Value</th><th>Closing Value</th><th>COGS</th><th>Sale Amount</th><th>Expense</th><th>State Tax</th><th>Operating Profit</th></tr>${body}<tr><th>TOTAL</th><th>${qtyText(calc.total.openingQty,'TOTAL')}</th><th>${qtyText(calc.total.purchaseQty,'TOTAL')}</th><th>${qtyText(calc.total.saleQty,'TOTAL')}</th><th>${qtyText(calc.total.closingQty,'TOTAL')}</th><th>${money(calc.total.openingValue)}</th><th>${money(calc.total.purchaseCost)}</th><th>${money(calc.total.closingValue)}</th><th>${money(calc.total.cogs)}</th><th>${money(calc.total.sale)}</th><th>${money(calc.total.expense)}</th><th>${money(calc.total.stateTax)}</th><th>${money(calc.total.profit)}</th></tr></table><div class="summary"><div>CNG Matched Purchase Qty: <b>${qtyText(calc.CNG.matchedPurchaseQty,'CNG')}</b></div><div>CNG Unmatched Sale Qty: <b>${qtyText(calc.CNG.unmatchedSaleQty,'CNG')}</b></div><div>CNG Unmatched Sale Amount: <b>${money(calc.CNG.unmatchedSaleAmount)}</b></div><div>CNG Unmatched Purchase Qty: <b>${qtyText(calc.CNG.unmatchedPurchaseQty,'CNG')}</b></div><div>CNG Unmatched Purchase Cost: <b>${money(calc.CNG.unmatchedPurchaseCost)}</b></div><div>Salary Expense: <b>${money(salaryExpenseForPeriod)}</b></div><div>Electricity Expense: <b>${money(electricityExpenseForPeriod)}</b></div><div class="final">Final Net Profit: ${money(calc.total.profit-salaryExpenseForPeriod-electricityExpenseForPeriod)}</div></div><script>window.addEventListener('load',()=>setTimeout(()=>{try{window.focus();window.print();}catch(e){}},500));<\/script></body></html>`;
    try{w.document.open();w.document.write(html);w.document.close();w.focus();}catch(err){try{w.close();}catch{}alert('Print report खुल नहीं पाया। कृपया दोबारा Print / PDF दबाएँ।');}
  };

  return <div className="content">
      <SecurityNotice />
    <section className="panel">
      <h2>📊 Sale ↔ Purchase P&L</h2>
      <p style={{marginTop:0,color:'#6b7280'}}>MS/HSD/Lubricant stock-based P&L और CNG bill-after-sale matched COGS. CNG में Physical Opening/Closing Stock नहीं है। CNG purchase bill बाद में बनने पर भी earlier sale से FIFO basis पर match होगा। DSR Difference P&L में शामिल नहीं है। CNG Sale Amount पर configured State Tax अलग से घटाया जाता है।</p>
      <div className="form"><label>Financial Year<select value={selectedFY} onChange={e=>setSelectedFY(e.target.value)}>{FINANCIAL_YEARS.map(y=><option key={y.value} value={y.value}>{y.label}</option>)}</select></label><label>From Date<input type="date" min={START_DATE} value={from} onChange={e=>{const v=e.target.value; if(!assertPeriodDate(v,'From Date')) setFrom(v);}}/></label><label>To Date<input type="date" min={START_DATE} value={to} onChange={e=>{const v=e.target.value; if(!assertPeriodDate(v,'To Date')) setTo(v);}}/></label></div>
      <div style={{display:'flex',gap:10,marginTop:14}}><button className="btn" onClick={exportExcel}>📊 Excel</button><button className="btn" onClick={printReport}>🖨️ Print / PDF</button></div>
    </section>
    <section className="panel" style={{marginTop:18,border:'2px solid #2563eb',background:'#f8fbff'}}>
      <h3 style={{marginTop:0}}>📌 FINAL P&L — Salary + Electricity Adjustment</h3>
      <p style={{margin:'4px 0 12px',fontSize:12,color:'#475569'}}>Default period: <b>{fy.start} से 31-08-2026</b>. Purchase Value हमेशा <b>Assessable Value + Tax Amount</b> होगी। Salary और Electricity Expense सीधे Final Net Profit से घटते हैं। DSR Difference का P&L profit पर कोई असर नहीं है।</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:12,marginTop:12}}>
        <div className="mini"><span>MS + HSD ACTUAL PURCHASE</span><strong>{money(actualMSHSDPurchaseTotal)}</strong><small>Actual HPCL invoice Total Amount for selected period</small></div>
        <div className="mini"><span>SALARY EXPENSE</span><strong>{money(salaryExpenseForPeriod)}</strong><small>Selected period staff salary</small></div>
        <div className="mini"><span>ELECTRICITY EXPENSE</span><strong>{money(electricityExpenseForPeriod)}</strong><small>Saved electricity bills for selected period</small></div>
      </div>
      <div className="mini" style={{marginTop:12}}><span>FINAL NET PROFIT</span><strong>{money(calc.total.profit-salaryExpenseForPeriod-electricityExpenseForPeriod)}</strong><small>Operating Profit − Salary − Electricity</small></div>
      <div style={{marginTop:12,padding:'10px 12px',borderRadius:10,background:'#f8fafc',fontSize:11,lineHeight:1.6}}>
        <b>Electricity:</b> Selected period में saved electricity bills के amounts expense में शामिल होते हैं। DSR Difference को Final Net Profit में शामिल नहीं किया गया है।
      </div>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <Table headers={['Fuel','Opening Balance','Purchase / Bill Qty','Sale','Closing Balance','Opening Value','Purchase / Matched Cost','Closing Value','COGS','Sale Amount','Expense','State Tax','Profit']} rows={fuelList.map(f=>[f,f==='CNG'?'N/A':qtyText(calc[f].openingQty,f),qtyText(calc[f].purchaseQty,f),qtyText(calc[f].saleQty,f),f==='CNG'?'N/A':qtyText(calc[f].closingQty,f),f==='CNG'?'N/A':money(calc[f].openingValue),f==='CNG'?money(calc[f].matchedPurchaseCost):money(calc[f].purchaseCost),f==='CNG'?'N/A':money(calc[f].closingValue),money(calc[f].cogs),money(calc[f].sale),money(calc[f].expense),money(calc[f].stateTax),money(calc[f].profit)]).concat([['TOTAL',qtyText(calc.total.openingQty,'TOTAL'),qtyText(calc.total.purchaseQty,'TOTAL'),qtyText(calc.total.saleQty,'TOTAL'),qtyText(calc.total.closingQty,'TOTAL'),money(calc.total.openingValue),money(displayPurchaseCostTotal(calc.MS,calc.HSD,calc.CNG,calc.LUBRICANT)),money(calc.total.closingValue),money(calc.total.cogs),money(calc.total.sale),money(calc.total.expense),money(calc.total.stateTax),money(calc.total.profit)]])}/>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <h3>👥 Staff Salary Included in P&L</h3>
      <div style={{overflowX:'auto'}}><Table headers={['Staff','Role','Monthly Salary']} rows={staff.map(person=>[person.name||'—',person.role||'—',money(person.salary)])}/></div>
      <div style={{marginTop:12,fontWeight:700}}>Total Salary Expense for Selected Period: {money(salaryExpenseForPeriod)}</div>
    </section>
    <section className="panel" style={{marginTop:18}}>
      <h3>🧾 CNG Bill-after-Sale Matching</h3>
      <p style={{color:'#475569',fontSize:12}}>CNG का physical stock नहीं रखा जाता। Purchase bill की quantity/cost को पहले की CNG sale से FIFO basis पर match किया जाता है, इसलिए bill बाद में बनने पर भी उस sale का COGS सही purchase cost से जुड़ सकता है.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:10}}>
        <div className="mini"><span>CNG SALE</span><strong>{qtyText(calc.CNG.saleQty,'CNG')}</strong></div>
        <div className="mini"><span>MATCHED PURCHASE</span><strong>{qtyText(calc.CNG.matchedPurchaseQty,'CNG')}</strong><small>{money(calc.CNG.matchedPurchaseCost)}</small></div>
        <div className="mini"><span>UNMATCHED SALE</span><strong>{qtyText(calc.CNG.unmatchedSaleQty,'CNG')}</strong><small>{money(calc.CNG.unmatchedSaleAmount)}</small></div>
        <div className="mini"><span>UNMATCHED PURCHASE</span><strong>{qtyText(calc.CNG.unmatchedPurchaseQty,'CNG')}</strong><small>{money(calc.CNG.unmatchedPurchaseCost)}</small></div>
        <div className="mini"><span>CROSS-PERIOD MATCH</span><strong>{qtyText(cngSalePurchaseMatching.matchedPurchaseOutsidePeriod,'CNG')}</strong><small>Selected-period sales matched to bills outside selected bill dates</small></div>
        <div className="mini"><span>CNG COGS</span><strong>{money(calc.CNG.cogs)}</strong><small>Only matched purchase cost</small></div>
      </div>
      {calc.CNG.unmatchedSaleQty>0 && <div style={{marginTop:12,padding:10,borderRadius:8,background:'#fff7ed',border:'1px solid #fed7aa',color:'#9a3412',fontSize:12}}><b>⚠️ CNG Purchase Bill Pending:</b> {qtyText(calc.CNG.unmatchedSaleQty,'CNG')} sale अभी purchase bill से match नहीं हुई है. CNG profit/COGS इस unmatched quantity के लिए provisional है.</div>}
      <div style={{marginTop:10,padding:10,borderRadius:8,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1e3a8a',fontSize:12}}><b>🔎 CNG 10-Aug verification:</b> HPCL Invoice 9024427628 = 1,058 Kg. Same invoice/fuel/qty/total duplicate rows are automatically collapsed; the bill is counted once only.</div>
      {calc.CNG.unmatchedPurchaseQty>0 && <div style={{marginTop:12,padding:10,borderRadius:8,background:'#eff6ff',border:'1px solid #bfdbfe',color:'#1d4ed8',fontSize:12}}><b>ℹ️ Unmatched Purchase Bill Qty:</b> {qtyText(calc.CNG.unmatchedPurchaseQty,'CNG')} purchase quantity अभी किसी CNG sale पर apply नहीं हुई है. यह केवल reconciliation visibility है; CNG COGS logic नहीं बदला गया है.</div>}
      <div style={{marginTop:14,lineHeight:1.8,color:'#374151'}}><div><b>MS / HSD COGS</b> = Opening Stock Value + Purchase Value − Closing Stock Value</div><div><b>Purchase Tax Policy</b> = Assessable Value + Tax is one landed Inventory/COGS value; Journal uses the same value (no separate ITC posting).</div><div><b>CNG COGS</b> = Purchase Bills Matched to CNG Sales (later bill dates allowed)</div><div><b>CNG Physical Opening / Closing Stock</b> = N/A</div><div><b>Lubricant Stock</b> = Optional Opening + Lubricant Purchases − Lubricant Sales (Credit Sale Register)</div><div><b>CNG State Tax</b> = CNG Sale Amount × configured State Tax rate</div><div><b>Salary Expense</b> = Saved Monthly Salary for the selected period (partial month is calendar-day prorated)</div><div><b>Electricity Expense</b> = Selected period के saved electricity bills का total</div><div><b>DSR Difference</b> = P&L profit में शामिल नहीं है</div><div><b>Final Net Profit</b> = Total Operating Profit − Salary Expense − Electricity Expense</div></div>
    </section>
  </div>;
}

/* =========================================================
   DAILY SALE SUMMARY
   01-08-2026 onwards
========================================================= */

export function DailySaleSummary({ data }) {
  const [date, setDate] = useState(START_DATE);

  const availableDates = useMemo(() => {
    const set = new Set([START_DATE]);

    (data.sales || []).forEach(s => {
      if (s.date >= START_DATE) set.add(s.date);
    });

    (data.dailyPayments || []).forEach(p => {
      if (p.date >= START_DATE) set.add(p.date);
    });

    (data.recoveries || []).forEach(r => {
      if (r.date >= START_DATE) set.add(r.date);
    });

    (data.credits || []).forEach(c => {
      if (c.date >= START_DATE) set.add(c.date);
    });

    (data.lubricantCashSales || []).forEach(c => {
      if (c.date >= START_DATE) set.add(c.date);
    });

    return Array.from(set).sort().reverse();
  }, [data.sales, data.dailyPayments, data.recoveries, data.credits, data.lubricantCashSales]);

  const rows = NOZZLES.map(([nozzle, fuel]) => {
    const savedCandidates = (data.sales || []).filter(
      s => s.date === date && s.nozzle === nozzle
    );
    const saved = savedCandidates.find(
      s => s.fingerprintVersion === 1 && s._integrityVerified
    ) || savedCandidates.find(s => s.fingerprintVersion === 1) || savedCandidates[0];

    const opening = openingFor(data, nozzle, date);
    const closing = saved ? n(saved.closing) : "";
    const meterQty =
      saved && closing !== ""
        ? Math.max(0, n(closing) - opening)
        : 0;
    const testing = saved ? n(saved.testing) : 0;
    const qty = saved ? n(saved.qty) : 0;
    const rate = saved ? n(saved.rate) : getRate(data, fuel, date);
    const amount = saved ? n(saved.amount) : rupee(qty * rate);

    return {
      nozzle,
      fuel,
      opening,
      closing,
      meterQty,
      testing,
      qty,
      rate,
      amount,
      saved: !!saved
    };
  });

  const lubricantCreditSales = (data.credits || []).filter(c =>
    c.date === date && String(c.fuel || '').toUpperCase() === 'LUBRICANT'
  );
  const lubricantCashSales = (data.lubricantCashSales || []).filter(c =>
    c.date === date && String(c.paymentMode || '').toUpperCase() === 'CASH'
  );
  const lubricantSales = [
    ...lubricantCreditSales.map(c => ({...c, _paymentType:'CREDIT'})),
    ...lubricantCashSales.map(c => ({...c, _paymentType:'CASH'}))
  ];
  const lubricantSummary = {
    qty: lubricantSales.reduce((a, c) => a + n(c.qty), 0),
    amount: lubricantSales.reduce((a, c) => a + n(c.amount), 0),
    entries: lubricantSales.length,
    creditAmount: lubricantCreditSales.reduce((a,c)=>a+n(c.amount),0),
    cashAmount: lubricantCashSales.reduce((a,c)=>a+n(c.amount),0)
  };

  const fuelSummary = {
    MS: { qty: 0, amount: 0 },
    HSD: { qty: 0, amount: 0 },
    CNG: { qty: 0, amount: 0 },
    LUBRICANT: lubricantSummary
  };

  rows.forEach(r => {
    fuelSummary[r.fuel].qty += n(r.qty);
    fuelSummary[r.fuel].amount += n(r.amount);
  });

  // Udhari हमेशा Credit Sale Register से आएगी.
  // पुराने saved payment में credit: 0 होने पर भी वास्तविक Udhari दिखेगी.
  const creditByFuel = {
    MS: creditTotalForFuel(data, date, "MS"),
    HSD: creditTotalForFuel(data, date, "HSD"),
    CNG: creditTotalForFuel(data, date, "CNG")
  };

  // Payment Breakdown compatibility layer:
  // Historical days can contain duplicate/partial daily-payment rows.
  // Prefer the most complete fuel-wise row, while keeping Credit Sale Register
  // as the authoritative source for Udhari/Credit. This fixes legacy dates
  // without touching the frozen accounting/storage/cloud-sync core.
  const paymentRowsForDate = (data.dailyPayments || []).filter(
    r => String(r?.date || "") === String(date)
  );

  const paymentRowScore = row => {
    const fuels = ["MS", "HSD", "CNG"];
    return fuels.reduce((score, fuel) => {
      const p = row?.[fuel];
      if (!p || typeof p !== "object") return score;
      const keys = ["cash", "paytm", "card", "dtplus", "hppay", "phonepe", "credit", "pumpExpense", "other"];
      return score + keys.reduce((nKeys, key) =>
        nKeys + (p[key] !== undefined && p[key] !== "" ? 1 : 0), 0
      );
    }, 0);
  };

  const paymentRow = paymentRowsForDate.reduce((best, row) =>
    !best || paymentRowScore(row) > paymentRowScore(best) ? row : best, null
  );

  const payment = paymentRow || savedPayment(data, date) || {};

  const paymentForFuel = fuel => {
    const raw = payment?.[fuel];
    const p = raw && typeof raw === "object" ? raw : {};
    const standard = paymentForFuelStandard(data, date, fuel) || {};

    // Support historical aliases/shapes without changing stored records.
    const cash = n(p.cash ?? standard.cash);
    const paytm = n(p.paytm ?? standard.paytm);
    const card = n(p.card ?? standard.card);
    const dtplus = n(p.dtplus ?? p.dtPlus ?? standard.dtplus);
    const hppay = n(p.hppay ?? p.hpPay ?? standard.hppay);
    const phonepe = n(p.phonepe ?? p.phonePe ?? standard.phonepe);
    const savedCredit = n(p.credit ?? p.udhari ?? standard.credit);
    const ledgerCredit = n(creditByFuel[fuel]);
    const credit = ledgerCredit > 0 ? ledgerCredit : savedCredit;
    const pumpExpense = n(p.pumpExpense ?? standard.pumpExpense) +
      (p.pumpExpense === undefined && p.other !== undefined ? n(p.other) : 0);

    const receiptTotal =
      cash + paytm + card + dtplus + hppay + phonepe;
    const reconciliationTotal = receiptTotal + credit;
    const densityExpense = (fuel === "MS" || fuel === "HSD") ? n(p.densityExpense) : 0;
    const jump = n(p.jump);
    const adjustedReconciliationTotal = reconciliationTotal + pumpExpense + densityExpense + jump;

    return {
      cash,
      paytm,
      card,
      dtplus,
      hppay,
      phonepe,
      credit,
      other: pumpExpense,
      pumpExpense,
      total: reconciliationTotal,
      receiptTotal,
      densityReading: p.densityReading || "",
      densityExpense,
      jump,
      adjustedTotal: adjustedReconciliationTotal,
      difference: rupee(fuelSummary[fuel].amount - adjustedReconciliationTotal)
    };
  };

  const paymentsByFuel = {
    MS: paymentForFuel("MS"),
    HSD: paymentForFuel("HSD"),
    CNG: paymentForFuel("CNG")
  };

  const pendingBefore = previousPending(data, date);

  const recoveryByFuel = {
    MS: 0,
    HSD: 0,
    CNG: 0
  };

  (data.recoveries || [])
    .filter(r => r.date === date)
    .forEach(r => {
      if (recoveryByFuel[r.fuel] !== undefined) {
        recoveryByFuel[r.fuel] += n(r.amount);
      }
    });

  const remainingPending = {
    MS: Math.max(0, pendingBefore.MS - recoveryByFuel.MS),
    HSD: Math.max(0, pendingBefore.HSD - recoveryByFuel.HSD),
    CNG: Math.max(0, pendingBefore.CNG - recoveryByFuel.CNG)
  };

  const salesmanPendingToday = {
    MS: Math.max(0, paymentsByFuel.MS.difference),
    HSD: Math.max(0, paymentsByFuel.HSD.difference),
    CNG: Math.max(0, paymentsByFuel.CNG.difference)
  };

  const totalFuelSale =
    fuelSummary.MS.amount +
    fuelSummary.HSD.amount +
    fuelSummary.CNG.amount;
  const totalSale = totalFuelSale + fuelSummary.LUBRICANT.amount;

  // Lubricant sale is currently a non-fuel credit sale, so its receivable
  // is included in the day's total payment/reconciliation as Credit/Udhari.
  const totalPayment =
    paymentsByFuel.MS.total +
    paymentsByFuel.HSD.total +
    paymentsByFuel.CNG.total +
    lubricantSummary.amount;

  const totalPumpExpense =
    paymentsByFuel.MS.pumpExpense +
    paymentsByFuel.HSD.pumpExpense +
    paymentsByFuel.CNG.pumpExpense;

  // Expense was paid before the salesman deposited cash. Therefore it
  // reduces the cash to be deposited, but it still belongs to the expense
  // account and must be added back for sale reconciliation.
  const totalAdjustment = ["MS","HSD","CNG"].reduce((sum,fuel) => sum + n(paymentsByFuel[fuel].densityExpense) + n(paymentsByFuel[fuel].jump), 0);
  const totalDifference = rupee(totalSale - totalPayment - totalPumpExpense - totalAdjustment);

  const paymentMethods = METHODS;

  const fuelCard = fuel => {
    const p = paymentsByFuel[fuel];
    return (
      <section className="panel" style={{ marginTop: 18 }}>
        <h3>{fuel} Payment Breakdown</h3>
        <p style={{marginTop:0,color:"#6b7280"}}>Credit is a trade receivable · Pump Expense is posted separately and added back only for cash-deposit reconciliation.</p>
        <div className="table">
          <table>
            <thead>
              <tr>
                {paymentMethods.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
                <th>Receipt Total</th>
                <th>Density Expense</th>
                <th>JUMP</th>
                <th>Pump Expense</th>
                <th>Adjusted Difference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {paymentMethods.map(([k]) => (
                  <td key={k}>{money(p[k])}</td>
                ))}
                <td><b>{money(p.receiptTotal)}</b></td>
                <td><b>{money(p.densityExpense)}</b></td>
                <td><b>{money(p.jump)}</b></td>
                <td><b>{money(p.pumpExpense)}</b></td>
                <td><b>{money(p.difference)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  const fmtQty = (value, fuel) =>
    n(value).toFixed(fuel === "CNG" ? 3 : 2);

  const escapeCsv = value => {
    const text = String(value ?? "");
    return /[",\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };

  function exportExcel() {
    const lines = [];
    lines.push(["SATAT FILLING STATION"].map(escapeCsv).join(","));
    lines.push(["Daily Sale Summary", date].map(escapeCsv).join(","));
    lines.push("");
    lines.push([
      "Nozzle", "Fuel", "Opening", "Closing", "Meter Qty",
      "Testing", "Sale Qty", "Rate", "Total Sale"
    ].map(escapeCsv).join(","));

    rows.forEach(r => {
      lines.push([
        r.nozzle,
        r.fuel,
        fmtQty(r.opening, r.fuel),
        r.saved ? fmtQty(r.closing, r.fuel) : "",
        fmtQty(r.meterQty, r.fuel),
        fmtQty(r.testing, r.fuel),
        fmtQty(r.qty, r.fuel),
        n(r.rate).toFixed(2),
        n(r.amount).toFixed(2)
      ].map(escapeCsv).join(","));
    });

    lines.push("");
    lines.push(["Fuel", "Sale Qty", "Total Sale"].map(escapeCsv).join(","));
    ["MS", "HSD", "CNG"].forEach(fuel => {
      lines.push([
        fuel,
        fmtQty(fuelSummary[fuel].qty, fuel),
        n(fuelSummary[fuel].amount).toFixed(2)
      ].map(escapeCsv).join(","));
    });
    lines.push([
      "LUBRICANT / MOBILE OIL (HPCL)",
      lubricantSummary.qty.toFixed(2) + " Ltr",
      lubricantSummary.amount.toFixed(2)
    ].map(escapeCsv).join(","));

    lines.push("");
    lines.push(["Fuel", "Cash", "Paytm + ATM (POS)", "DT Plus", "HP Pay", "PhonePe", "Udhari / Credit", "Pump Expense / Other", "Density Reading", "Density Expense", "JUMP", "Receipt Total", "Adjusted Difference"].map(escapeCsv).join(","));
    ["MS", "HSD", "CNG"].forEach(fuel => {
      const p = paymentsByFuel[fuel];
      lines.push([
        fuel, p.cash, p.paytm, p.dtplus, p.hppay,
        p.phonepe, p.credit, p.other, p.densityReading || "", p.densityExpense || 0, p.jump || 0, p.total, p.difference
      ].map(escapeCsv).join(","));
    });

    lines.push("");
    lines.push(["Fuel", "Previous Receivable Difference", "Recovery Today", "Remaining Reconciliation Difference", "Today's Adjusted Difference"].map(escapeCsv).join(","));
    ["MS", "HSD", "CNG"].forEach(fuel => {
      lines.push([
        fuel,
        pendingBefore[fuel],
        recoveryByFuel[fuel],
        remainingPending[fuel],
        salesmanPendingToday[fuel]
      ].map(escapeCsv).join(","));
    });

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Daily_Sale_Summary_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    const esc = value => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");

    const nozzleRows = rows.map(r => `
      <tr>
        <td>${esc(r.nozzle)}</td><td>${esc(r.fuel)}</td>
        <td>${fmtQty(r.opening, r.fuel)}</td>
        <td>${r.saved ? fmtQty(r.closing, r.fuel) : "—"}</td>
        <td>${fmtQty(r.meterQty, r.fuel)}</td>
        <td>${fmtQty(r.testing, r.fuel)}</td>
        <td>${fmtQty(r.qty, r.fuel)}</td>
        <td>${money(r.rate)}</td><td>${money(r.amount)}</td>
      </tr>`).join("");

    const paymentRows = ["MS", "HSD", "CNG"].map(fuel => {
      const p = paymentsByFuel[fuel];
      return `<tr>
        <td><b>${fuel}</b></td><td>${money(fuelSummary[fuel].amount)}</td>
        <td>${money(p.cash)}</td><td>${money(p.paytm)}</td>
        <td>${money(p.dtplus)}</td><td>${money(p.hppay)}</td><td>${money(p.phonepe)}</td>
        <td>${money(p.credit)}</td><td>${money(p.other)}</td>
        <td>${money(p.total)}</td><td>${money(p.difference)}</td>
      </tr>`;
    }).join("");

    const pendingRows = ["MS", "HSD", "CNG"].map(fuel => `
      <tr><td><b>${fuel}</b></td>
      <td>${money(pendingBefore[fuel])}</td>
      <td>${money(recoveryByFuel[fuel])}</td>
      <td>${money(remainingPending[fuel])}</td>
      <td>${money(salesmanPendingToday[fuel])}</td></tr>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Daily Sale Summary ${esc(date)}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111}h1,h2{margin:0 0 8px}h2{margin-top:22px;font-size:18px}p{margin:4px 0 12px}
        table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{border:1px solid #555;padding:6px;font-size:11px;text-align:right}th{background:#eee;text-align:center}td:first-child,td:nth-child(2){text-align:left}
        .cards{display:flex;gap:10px;margin:10px 0}.card{border:1px solid #555;padding:10px;flex:1}.ok{padding:8px;border:1px solid #333;font-weight:bold}
        @media print{@page{size:A4 landscape;margin:10mm}button{display:none}}
      </style></head><body>
      <h1>SATAT FILLING STATION</h1><p><b>Daily Sale Summary</b> — ${esc(date)}</p>
      <h2>1. Nozzle-wise Opening / Closing / Sale</h2>
      <table><thead><tr><th>Nozzle</th><th>Fuel</th><th>Opening</th><th>Closing</th><th>Meter Qty</th><th>Testing</th><th>Sale Qty</th><th>Rate</th><th>Total Sale</th></tr></thead><tbody>${nozzleRows}</tbody></table>
      <h2>2. Fuel-wise Total Sale</h2>
      <table><thead><tr><th>Fuel</th><th>Sale Qty</th><th>Total Sale</th></tr></thead><tbody>
        ${["MS","HSD","CNG"].map(f => `<tr><td>${f}</td><td>${fmtQty(fuelSummary[f].qty,f)} ${f === "CNG" ? "Kg" : "L"}</td><td>${money(fuelSummary[f].amount)}</td></tr>`).join("")}
        <tr><td>LUBRICANT / MOBILE OIL (HPCL)</td><td>${lubricantSummary.qty.toFixed(2)} Ltr</td><td>${money(lubricantSummary.amount)}</td></tr>
      </tbody></table>
      <h2>3. Payment Breakdown — MS / HSD / CNG</h2>
      <table><thead><tr><th>Fuel</th><th>Sale</th><th>Cash</th><th>Paytm + ATM (POS)</th><th>DT Plus</th><th>HP Pay</th><th>PhonePe</th><th>Udhari</th><th>Other</th><th>Total Payment</th><th>Difference</th></tr></thead><tbody>${paymentRows}</tbody></table>
      <h2>4. Reconciliation Difference / Recovery — Fuel-wise</h2>
      <table><thead><tr><th>Fuel</th><th>Previous Receivable Difference</th><th>Recovery Today</th><th>Remaining Reconciliation Difference</th><th>Today's Pending</th></tr></thead><tbody>${pendingRows}</tbody></table>
      <h2>5. Final Total</h2>
      <table><thead><tr><th>Total Sale</th><th>Total Payment</th><th>Adjusted Difference</th><th>Total Today's Pending</th></tr></thead><tbody><tr>
        <td>${money(totalSale)}</td><td>${money(totalPayment)}</td><td>${money(totalDifference)}</td>
        <td>${money(salesmanPendingToday.MS + salesmanPendingToday.HSD + salesmanPendingToday.CNG)}</td>
      </tr></tbody></table>
      <div class="ok">${Math.abs(totalDifference) <= 0.50 ? "✓ Daily Sale / Payment Status: OK" : `⚠ Daily Difference: ${money(totalDifference)}`}</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Print window blocked है. Browser में pop-up allow करें.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function shareWhatsApp() {
    const p = f => paymentsByFuel[f];
    const msg = [
      `*SATAT FILLING STATION*`,
      `*Daily Sale Summary - ${date}*`,
      ``,
      `MS Sale: ${money(fuelSummary.MS.amount)} | Payment: ${money(p("MS").total)} | Udhari: ${money(p("MS").credit)} | Pending: ${money(salesmanPendingToday.MS)}`,
      `HSD Sale: ${money(fuelSummary.HSD.amount)} | Payment: ${money(p("HSD").total)} | Udhari: ${money(p("HSD").credit)} | Pending: ${money(salesmanPendingToday.HSD)}`,
      `CNG Sale: ${money(fuelSummary.CNG.amount)} | Payment: ${money(p("CNG").total)} | Udhari: ${money(p("CNG").credit)} | Pending: ${money(salesmanPendingToday.CNG)}`,
      `Lubricant / Mobile Oil: ${lubricantSummary.qty.toFixed(2)} Ltr | Sale: ${money(lubricantSummary.amount)} | Udhari: ${money(lubricantSummary.amount)}`,
      ``,
      `Grand Sale: ${money(totalSale)}`,
      `Grand Payment: ${money(totalPayment)}`,
      `Grand Difference: ${money(totalDifference)}`,
      ``,
      `Previous Receivable Difference: MS ${money(pendingBefore.MS)} | HSD ${money(pendingBefore.HSD)} | CNG ${money(pendingBefore.CNG)}`,
      `Recovery Today: MS ${money(recoveryByFuel.MS)} | HSD ${money(recoveryByFuel.HSD)} | CNG ${money(recoveryByFuel.CNG)}`,
      `Remaining Reconciliation Difference: MS ${money(remainingPending.MS)} | HSD ${money(remainingPending.HSD)} | CNG ${money(remainingPending.CNG)}`
    ].join("\n");

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="content">
      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div>
            <h2>Daily Sale Summary</h2>
            <p>01-08-2026 से दिनवार पूरा बिक्री हिसाब</p>
          </div>

          <Field label="Summary Date">
            <select value={date} onChange={e => setDate(e.target.value)}>
              {availableDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={printPdf}>
            🖨️ Print / PDF
          </button>
          <button type="button" className="btn" onClick={exportExcel}>
            📊 Excel
          </button>
          <button type="button" className="btn" onClick={shareWhatsApp}>
            💬 WhatsApp
          </button>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h3>Nozzle-wise Opening / Closing / Sale</h3>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Nozzle</th><th>Fuel</th><th>Opening</th><th>Closing</th>
                <th>Meter Qty</th><th>Testing</th><th>Sale Qty</th>
                <th>Rate</th><th>Total Sale</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.nozzle}>
                  <td><b>{r.nozzle}</b></td>
                  <td>{r.fuel}</td>
                  <td>{fmtQty(r.opening, r.fuel)}</td>
                  <td>{r.saved ? fmtQty(r.closing, r.fuel) : "—"}</td>
                  <td>{fmtQty(r.meterQty, r.fuel)}</td>
                  <td>{fmtQty(r.testing, r.fuel)}</td>
                  <td><b>{fmtQty(r.qty, r.fuel)}</b></td>
                  <td>{money(r.rate)}</td>
                  <td><b>{money(r.amount)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h3>Fuel-wise Total Sale</h3>
        <div className="total-box">
          {["MS", "HSD", "CNG", "LUBRICANT"].map(fuel => (
            <div className="mini" key={fuel}>
              <span>{fuel} TOTAL SALE</span>
              <strong>
                {fmtQty(fuelSummary[fuel].qty, fuel)} {fuel === "CNG" ? "Kg" : fuel === "LUBRICANT" ? "Ltr" : "L"}
              </strong>
              <span style={{ marginTop: 6 }}>{money(fuelSummary[fuel].amount)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h3>Lubricant / Mobile Oil — Daily Sale</h3>
        <div className="table">
          <table>
            <thead><tr><th>Product</th><th>Entries</th><th>Sale Qty (Ltr)</th><th>Sale Amount</th><th>Payment</th></tr></thead>
            <tbody>
              {lubricantSales.length ? lubricantSales.map(c => (
                <tr key={c.id || `${c.date}|${c.parchiNo}`}>
                  <td><b>{c.productName || 'Mobile Oil (HPCL)'}</b></td>
                  <td>1</td>
                  <td>{n(c.qty) > 0 ? n(c.qty).toFixed(2) : 'Qty pending'}</td>
                  <td>{money(c.amount)}</td>
                  <td><b>{c._paymentType === 'CASH' ? 'CASH' : 'CREDIT / UDHARI'}</b></td>
                </tr>
              )) : <tr><td colSpan="5">आज कोई Lubricant sale नहीं है।</td></tr>}
              <tr className="total-row">
                <td><b>TOTAL LUBRICANT</b></td><td><b>{lubricantSummary.entries}</b></td>
                <td><b>{lubricantSummary.qty.toFixed(2)} Ltr</b></td>
                <td><b>{money(lubricantSummary.amount)}</b></td>
                <td><b>CASH {money(lubricantSummary.cashAmount)} · CREDIT {money(lubricantSummary.creditAmount)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {fuelCard("MS")}
      {fuelCard("HSD")}
      {fuelCard("CNG")}
      <section className="panel" style={{ marginTop: 18 }}>
        <h3>🧪 Density + ↕️ JUMP — Daily Record</h3>
        <p style={{marginTop:0,color:"#6b7280"}}>
          Cloud में saved Daily Payment record से Density Reading / Density Expense / JUMP दिखाए जा रहे हैं।
          यह display-only summary है; existing sales और cloud data को बदला नहीं जाता।
        </p>
        <div className="table">
          <table>
            <thead><tr><th>Fuel</th><th>Density Reading</th><th>Density Expense</th><th>JUMP</th><th>Record Status</th></tr></thead>
            <tbody>
              {["MS","HSD","CNG"].map(fuel => {
                const p = paymentsByFuel[fuel] || {};
                const densityAllowed = fuel === "MS" || fuel === "HSD";
                const hasDensity = densityAllowed && (String(p.densityReading ?? "").trim() !== "" || n(p.densityExpense) !== 0);
                const hasJump = n(p.jump) !== 0;
                return <tr key={fuel}>
                  <td><b>{fuel}</b></td>
                  <td>{densityAllowed ? (String(p.densityReading ?? "").trim() || "—") : "N/A"}</td>
                  <td>{densityAllowed ? money(p.densityExpense) : "N/A"}</td>
                  <td>{money(p.jump)}</td>
                  <td>{hasDensity || hasJump ? "✓ Saved" : "— No entry"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h3>Reconciliation Difference / Recovery — Fuel-wise</h3>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Fuel</th><th>Previous Receivable Difference</th><th>Recovery Today</th>
                <th>Remaining Reconciliation Difference</th><th>Today's Adjusted Difference</th>
              </tr>
            </thead>
            <tbody>
              {["MS", "HSD", "CNG"].map(fuel => (
                <tr key={fuel}>
                  <td><b>{fuel}</b></td>
                  <td>{money(pendingBefore[fuel])}</td>
                  <td>{money(recoveryByFuel[fuel])}</td>
                  <td><b>{money(remainingPending[fuel])}</b></td>
                  <td><b>{money(salesmanPendingToday[fuel])}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {payment?.recoveryStatus === "PARTIAL_SOURCE_RECOVERY" && <section className="panel" style={{ marginTop: 18, border:'1px solid #f59e0b', background:'#fffbeb' }}>
        <h3>⚠️ 29-Aug Source Recovery</h3>
        <p style={{margin:0,fontSize:12}}>Actual POS total: <b>{money(payment.recoveredPOS || 0)}</b> · Credit Sale: <b>{money(payment.recoveredCredit || 0)}</b>. Fuel-wise Cash / Paytm / Card / DT Plus / HP Pay / PhonePe breakup source में उपलब्ध नहीं था, इसलिए system ने कोई amount invent नहीं किया है.</p>
      </section>}

      <section className="panel" style={{ marginTop: 18 }}>
        <h3>Final Daily Summary</h3>
        <div className="table">
          <table>
            <thead><tr>
              <th>Fuel</th><th>Total Sale</th><th>Total Payment</th>
              <th>Density Expense</th><th>JUMP</th><th>Pump Expense</th>
              <th>Adjusted Total</th><th>Adjusted Difference</th><th>Salesman Pending</th>
            </tr></thead>
            <tbody>
              {["MS", "HSD", "CNG"].map(fuel => (
                <tr key={fuel}>
                  <td><b>{fuel}</b></td>
                  <td>{money(fuelSummary[fuel].amount)}</td>
                  <td>{money(paymentsByFuel[fuel].total)}</td>
                  <td>{money(paymentsByFuel[fuel].densityExpense)}</td>
                  <td>{money(paymentsByFuel[fuel].jump)}</td>
                  <td>{money(paymentsByFuel[fuel].pumpExpense)}</td>
                  <td><b>{money(n(paymentsByFuel[fuel].total)+n(paymentsByFuel[fuel].densityExpense)+n(paymentsByFuel[fuel].jump)+n(paymentsByFuel[fuel].pumpExpense))}</b></td>
                  <td>{money(paymentsByFuel[fuel].difference)}</td>
                  <td>{money(salesmanPendingToday[fuel])}</td>
                </tr>
              ))}
              <tr>
                <td><b>LUBRICANT</b></td><td>{money(lubricantSummary.amount)}</td><td>{money(lubricantSummary.amount)}</td>
                <td>{money(0)}</td><td>{money(0)}</td><td>{money(0)}</td>
                <td><b>{money(lubricantSummary.amount)}</b></td><td>{money(0)}</td><td>{money(0)}</td>
              </tr>
              <tr>
                <td><b>GRAND TOTAL</b></td><td><b>{money(totalSale)}</b></td><td><b>{money(totalPayment)}</b></td>
                <td><b>{money(n(paymentsByFuel.MS.densityExpense)+n(paymentsByFuel.HSD.densityExpense))}</b></td>
                <td><b>{money(n(paymentsByFuel.MS.jump)+n(paymentsByFuel.HSD.jump)+n(paymentsByFuel.CNG.jump))}</b></td>
                <td><b>{money(n(paymentsByFuel.MS.pumpExpense)+n(paymentsByFuel.HSD.pumpExpense)+n(paymentsByFuel.CNG.pumpExpense))}</b></td>
                <td><b>{money(n(totalPayment)+n(paymentsByFuel.MS.densityExpense)+n(paymentsByFuel.HSD.densityExpense)+n(paymentsByFuel.MS.jump)+n(paymentsByFuel.HSD.jump)+n(paymentsByFuel.CNG.jump)+n(paymentsByFuel.MS.pumpExpense)+n(paymentsByFuel.HSD.pumpExpense)+n(paymentsByFuel.CNG.pumpExpense))}</b></td>
                <td><b>{money(totalDifference)}</b></td>
                <td><b>{money(salesmanPendingToday.MS+salesmanPendingToday.HSD+salesmanPendingToday.CNG)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{margin:'10px 0 0',fontSize:12,color:'#475569'}}>Adjusted Total = Total Payment + Density Expense + JUMP + Pump Expense. Density/JUMP को Difference में दोबारा नहीं गिना जाता।</p>
        <div className={Math.abs(totalDifference) <= 0.50 ? "balance-ok" : "balance-bad"}>
          {Math.abs(totalDifference) <= 0.50 ? "✓ Daily Sale / Payment Status: OK" : `⚠ Daily Difference: ${money(totalDifference)}`}
        </div>
      </section>
    </div>
  );
}



/* =========================================================
   DATA QUALITY / AUDIT HELPERS — UI ONLY; NO ACCOUNTING LOGIC CHANGE
========================================================= */
export function DataQualityBadge({ data }) {
  // UI-only diagnostic. Kept deliberately hook-free so a malformed/partial
  // imported dataset can never crash the Stock module while rendering the badge.
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const payments = Array.isArray(data?.dailyPayments) ? data.dailyPayments : [];
  const dips = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
  const start = START_DATE;
  const end = '2026-08-31';
  const issues = [];
  const d = new Date(`${start}T12:00:00`);
  const e = new Date(`${end}T12:00:00`);
  while (d <= e) {
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const hasSale = sales.some(x => String(x?.date || '') === iso);
    const hasPayment = payments.some(x => String(x?.date || '') === iso);
    const hasDip = dips.some(x => String(x?.date || '') === iso);
    if (!hasSale || !hasPayment || !hasDip) issues.push({date:iso, hasSale, hasPayment, hasDip});
    d.setDate(d.getDate()+1);
  }
  const aug29Recovered = sales.some(x => String(x?.date) === '2026-08-29' && x?.recoveryStatus === 'FORENSIC_RECOVERY');
  const aug29PaymentRecovered = payments.some(x => String(x?.date) === '2026-08-29' && x?.recoveryStatus === 'PARTIAL_SOURCE_RECOVERY');
  if (!issues.length && !aug29PaymentRecovered) {
    return <div style={{marginTop:12,padding:'10px 12px',borderRadius:10,border:'1px solid #86efac',background:'#f0fdf4',fontSize:12}}>
      <b>✓ Data Quality Check: August 2026 complete</b>
      {aug29Recovered && <div style={{marginTop:5}}>29-Aug sales were restored from the saved meter/DSR evidence and are tagged as forensic recovery.</div>}
    </div>;
  }
  return <div style={{marginTop:12,padding:'10px 12px',borderRadius:10,border:'1px solid #f59e0b',background:'#fffbeb',fontSize:12}}>
    <b>⚠ Data Quality Check — {issues.length ? `${issues.length} day(s) need attention` : 'review required'}</b>
    {issues.length > 0 && <div style={{marginTop:6}}>{issues.map(x => <div key={x.date}>{x.date}: {!x.hasSale&&'Sales missing'}{(!x.hasSale&&!x.hasPayment)?' • ':''}{!x.hasPayment&&'Payment missing'}{((!x.hasSale||!x.hasPayment)&&!x.hasDip)?' • ':''}{!x.hasDip&&'MS/HSD Dip missing'}</div>)}</div>}
    {aug29PaymentRecovered && <div style={{marginTop:7,padding:8,borderRadius:7,background:'#fff7ed',border:'1px solid #fed7aa'}}><b>29-Aug payment recovery:</b> actual POS total ₹205,110 and Credit Sale ₹60 are preserved from source. The fuel-wise Cash/Paytm/Card/DT Plus/HP Pay/PhonePe breakup was not present in the source, so it has <u>not</u> been invented.</div>}
  </div>;
}

/* =========================================================
   STOCK
========================================================= */

export function Stock({
  data,
  update,
  totals
}) {
  const salesRows = Array.isArray(data?.sales) ? data.sales : [];
  const fillingsRows = Array.isArray(data?.fillings) ? data.fillings : [];
  const dipRows = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
  const safeRates = data?.rates || { MS:0, HSD:0, CNG:0 };
  const dataQualityBadge = <DataQualityBadge data={data} />;

  // Stock/DSR must use one authoritative sale per date + nozzle.
  // Integrity recovery rows remain in raw backup but must not be counted
  // as an additional physical sale. Prefer verified fingerprint v1.
  const authoritativeSales = useMemo(() => {
    const groups = new Map();
    salesRows.forEach(s => {
      const key = `${s.date}|${s.nozzle}`;
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    });
    return Array.from(groups.values()).map(arr => {
      // Ignore forensic recovery duplicates when a genuine/source row exists.
      // Then prefer the latest verified/source row so Fuel Sale Testing edits
      // are the same values consumed by Stock Register.
      const source = arr.filter(s => String(s?.recoveryStatus || '') !== 'FORENSIC_RECOVERY');
      const candidates = source.length ? source : arr;
      return candidates.findLast?.(s => s.fingerprintVersion === 1 && s._integrityVerified) ||
        [...candidates].reverse().find(s => s.fingerprintVersion === 1 && s._integrityVerified) ||
        [...candidates].reverse().find(s => s.fingerprintVersion === 1) ||
        candidates[candidates.length - 1];
    });
  }, [salesRows]);
const [rateDate, setRateDate] = useState(START_DATE);

const [newMSRate, setNewMSRate] = useState("");
const [newHSDRate, setNewHSDRate] = useState("");
const [newCNGRate, setNewCNGRate] = useState("");

  const [dipDate, setDipDate] = useState(todayDate());
  const [dipValues, setDipValues] = useState({ MS: "", HSD: "" });
  const [dipMsg, setDipMsg] = useState("");

  function bookStockAsOf(date) {
    const d = String(date || todayDate());
    const sales = authoritativeSales.filter(x => x.date >= START_DATE && x.date <= d);
    const fillings = (Array.isArray(data.fillings) ? data.fillings : []).filter(x => x.date >= START_DATE && x.date <= d);
    const base = {
      MS: n(data.openingStock?.MS ?? 9356),
      HSD: n(data.openingStock?.HSD ?? 7500)
    };
    const out = { ...base };
    ["MS", "HSD"].forEach(fuel => {
      out[fuel] += fillings.filter(x => x.fuel === fuel).reduce((sum, x) => sum + n(x.qty), 0);
      out[fuel] -= sales.filter(x => x.fuel === fuel).reduce((sum, x) => sum + n(x.qty), 0);
    });
    return out;
  }

  function historicalDipForDate(date) {
    // User-saved physical Dip is authoritative. The embedded historical
    // table is only a fallback for dates that have no saved reading.
    const saved = (Array.isArray(data.dipReadings) ? data.dipReadings : []).find(x => x.date === date);
    if (saved) return { MS: n(saved.MS), HSD: n(saved.HSD) };
    const row = HISTORICAL_DIP_MS_HSD_2026_08.find(x => x[0] === date);
    return row ? { MS: row[1], HSD: row[2] } : null;
  }

  function previousDate(date) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Daily Opening / Opp. Stock is the recorded opening physical Dip for that date.
  // 01-08-2026 is the fixed accounting opening stock. From 02-08-2026 onward,
  // the date's own recorded DIP is its opening physical stock. For Sales By Dip,
  // the next day's DIP is used as the current day's closing physical stock.
  function openingStockForDate(date) {
    if (date === START_DATE) {
      return { MS: n(data.openingStock?.MS ?? 9356), HSD: n(data.openingStock?.HSD ?? 7500) };
    }
    const dip = historicalDipForDate(date);
    if (dip) return { MS: n(dip.MS), HSD: n(dip.HSD) };

    // If no physical opening DIP exists for this date, carry forward the
    // previous day's calculated book closing stock. Never reuse START_DATE
    // opening stock for later dates.
    const prevBook = bookStockAsOf(previousDate(date));
    return { MS: n(prevBook.MS), HSD: n(prevBook.HSD) };
  }

  function nextDate(date) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const selectedBookStock = bookStockAsOf(dipDate);
  const savedDip = (Array.isArray(data.dipReadings) ? data.dipReadings : []).find(x => x.date === dipDate);

  const dailyStockRows = useMemo(() => {
    const dates = new Set([START_DATE]);
    salesRows.forEach(x => { if (x.date >= START_DATE) dates.add(x.date); });
    fillingsRows.forEach(x => { if (x.date >= START_DATE) dates.add(x.date); });
    dipRows.forEach(x => { if (x.date >= START_DATE) dates.add(x.date); });
    HISTORICAL_DIP_MS_HSD_2026_08.forEach(([d]) => dates.add(d));
    const today = todayDate();
    if (today >= START_DATE) dates.add(today);

    let cumulative = 0;
    return Array.from(dates).sort().map(date => {
      const opening = openingStockForDate(date);
      const receivedByFuel = {
        MS: fillingsRows
          .filter(x => x.date === date && x.fuel === "MS")
          .reduce((sum, x) => sum + n(x.qty), 0),
        HSD: fillingsRows
          .filter(x => x.date === date && x.fuel === "HSD")
          .reduce((sum, x) => sum + n(x.qty), 0)
      };
      const received = receivedByFuel.MS + receivedByFuel.HSD;
      // Fuel Sale stores qty as NET SALE (meter movement minus pump testing).
      // Therefore stock reconciliation must NOT subtract testing a second time.
      // Meter movement = NET SALE + Pump Test; NET SALE = stored qty.
      const meter = authoritativeSales
        .filter(x => x.date === date && (x.fuel === "MS" || x.fuel === "HSD"))
        .reduce((sum, x) => sum + n(x.qty) + n(x.testing), 0);
      const pumpTest = authoritativeSales
        .filter(x => x.date === date && (x.fuel === "MS" || x.fuel === "HSD"))
        .reduce((sum, x) => sum + n(x.testing), 0);
      const netSale = meter - pumpTest;
      cumulative += netSale;
      const closingOpeningDip = historicalDipForDate(nextDate(date));
      const salesByDip = closingOpeningDip
        ? {
            MS: opening.MS + receivedByFuel.MS - closingOpeningDip.MS,
            HSD: opening.HSD + receivedByFuel.HSD - closingOpeningDip.HSD
          }
        : null;
      return { date, opening, received, receivedByFuel, totalStock: { MS: opening.MS + receivedByFuel.MS, HSD: opening.HSD + receivedByFuel.HSD }, meter, pumpTest, netSale, cumulative, closingOpeningDip, salesByDip };

    });
  }, [authoritativeSales, fillingsRows, dipRows, data.openingStock]);

  useEffect(() => {
    const row = (Array.isArray(data.dipReadings) ? data.dipReadings : []).find(x => x.date === dipDate);
    setDipValues({ MS: row?.MS ?? "", HSD: row?.HSD ?? "" });
    setDipMsg("");
  }, [dipDate, dipRows]);

  function saveDipReading() {
    setDipMsg("");
    if (!dipDate || dipDate < START_DATE) return setDipMsg("01-08-2026 से पहले की Dip entry allowed नहीं है।");
    if (dipValues.MS === "" || dipValues.HSD === "") return setDipMsg("MS और HSD दोनों की physical/dip quantity भरें।");
    if (["MS", "HSD"].some(f => n(dipValues[f]) < 0)) return setDipMsg("Dip quantity negative नहीं हो सकती।");
    const rows = Array.isArray(data.dipReadings) ? data.dipReadings : [];
    const next = [
      ...rows.filter(x => x.date !== dipDate),
      { id: savedDip?.id ?? Date.now(), date: dipDate, MS: n(dipValues.MS), HSD: n(dipValues.HSD) }
    ].sort((a,b) => String(a.date).localeCompare(String(b.date)));
    update({ dipReadings: next });
    setDipMsg(`Dip reading saved: ${dipDate}`);
  }

  function dipReportRows() {
    return (Array.isArray(data.dipReadings) ? data.dipReadings.slice() : [])
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map(r => {
        const book = bookStockAsOf(r.date);
        return {
          date: r.date,
          msDip: n(r.MS),
          msDiff: n(r.MS) - book.MS,
          hsdDip: n(r.HSD),
          hsdDiff: n(r.HSD) - book.HSD
        };
      });
  }

  function exportDipExcel() {
    const rows = dipReportRows();
    const csvRows = [
      ["DIP-WISE PHYSICAL STOCK", PUMP_NAME],
      ["Date", "MS Dip (L)", "MS Difference", "HSD Dip (L)", "HSD Difference"]
    ];
    rows.forEach(r => csvRows.push([
      r.date, r.msDip.toFixed(2), r.msDiff.toFixed(2),
      r.hsdDip.toFixed(2), r.hsdDiff.toFixed(2)
    ]));
    const csv = csvRows.map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Dip_Wise_Physical_Stock_${todayDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printDipPdf() {
    const rows = dipReportRows();
    const body = rows.map(r => `<tr>
      <td>${r.date}</td>
      <td>${r.msDip.toFixed(2)} L</td><td>${r.msDiff.toFixed(2)} L</td>
      <td>${r.hsdDip.toFixed(2)} L</td><td>${r.hsdDiff.toFixed(2)} L</td>
    </tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) {
      alert("Print window blocked है. Browser में pop-up allow करें.");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>Dip-wise Physical Stock</title>
      <style>body{font-family:Arial;margin:20px}h1,h2{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:6px;font-size:10px;text-align:right}th{background:#eee}th:first-child,td:first-child{text-align:left}</style>
      </head><body><h1>${PUMP_NAME}</h1><h2>Dip-wise Physical Stock</h2>
      <p>Accounting Period: 01-08-2026 onwards</p>
      <table><thead><tr><th>Date</th><th>MS Dip</th><th>MS Difference</th><th>HSD Dip</th><th>HSD Difference</th></tr></thead>
      <tbody>${body || '<tr><td colspan="7">No dip records found.</td></tr>'}</tbody></table>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }

  function shareDipWhatsApp() {
    const rows = dipReportRows();
    const latest = rows[rows.length - 1];
    const msg = latest
      ? `*${PUMP_NAME}*\n*Dip-wise Physical Stock*\nDate: ${latest.date}\nMS Dip: ${latest.msDip.toFixed(2)} L | Difference: ${latest.msDiff.toFixed(2)} L\nHSD Dip: ${latest.hsdDip.toFixed(2)} L | Difference: ${latest.hsdDiff.toFixed(2)} L\nTotal Dip Records: ${rows.length}`
      : `*${PUMP_NAME}*\n*Dip-wise Physical Stock*\nNo dip records found.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

function updateFuelRates() {
    setMsg("");

    if (!rateDate) {
      setMsg("कृपया Effective Date चुनें।");
      return;
    }

    if (rateDate < START_DATE) {
      setMsg("01-08-2026 से पहले का rate allowed नहीं है।");
      return;
    }

    const msRate = newMSRate === "" ? getRate(data, "MS", rateDate) : n(newMSRate);
    const hsdRate = newHSDRate === "" ? getRate(data, "HSD", rateDate) : n(newHSDRate);
    const cngRate = newCNGRate === "" ? getRate(data, "CNG", rateDate) : n(newCNGRate);

    if (msRate <= 0 || hsdRate <= 0 || cngRate <= 0) {
      setMsg("Rate 0 से अधिक होना चाहिए।");
      return;
    }

    const history = Array.isArray(data.rateHistory) ? data.rateHistory : [];

    const newHistory = [
      ...history.filter(r => r.date !== rateDate),
      { id: Date.now(), date: rateDate, MS: msRate, HSD: hsdRate, CNG: cngRate }
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const today = todayDate();
    const latest = latestRateHistory({ rateHistory: newHistory }, today);

    update({
      rates: latest
        ? { MS: n(latest.MS), HSD: n(latest.HSD), CNG: n(latest.CNG) }
        : data.rates,
      rateHistory: newHistory
    });

    setNewMSRate("");
    setNewHSDRate("");
    setNewCNGRate("");
    setMsg(`Rate saved: ${rateDate} | MS ₹${msRate.toFixed(2)} | HSD ₹${hsdRate.toFixed(2)} | CNG ₹${cngRate.toFixed(2)}`);
  }

  const [f, setF] =
    useState({
      fuel: "MS",
      qty: "",
      date: START_DATE,
      purchaseRef: ""
    });

  const [msg, setMsg] =
    useState("");

  /* ======================================================
     ACCOUNTING PERIOD
     केवल 01-08-2026 से calculation
  ====================================================== */

  const periodSales =
    data.sales.filter(
      s => s.date >= START_DATE
    );

  const periodFillings =
    data.fillings.filter(
      x => x.date >= START_DATE
    );

  /* ======================================================
     MS SALE
  ====================================================== */

  const msSale =
    periodSales
      .filter(
        s => s.fuel === "MS"
      )
      .reduce(
        (sum, s) =>
          sum + n(s.qty),
        0
      );

  /* ======================================================
     HSD SALE
  ====================================================== */

  const hsdSale =
    periodSales
      .filter(
        s => s.fuel === "HSD"
      )
      .reduce(
        (sum, s) =>
          sum + n(s.qty),
        0
      );

  /* ======================================================
     MS TANK FILLING
  ====================================================== */

  const msFilling =
    periodFillings
      .filter(
        x => x.fuel === "MS"
      )
      .reduce(
        (sum, x) =>
          sum + n(x.qty),
        0
      );

  /* ======================================================
     HSD TANK FILLING
  ====================================================== */

  const hsdFilling =
    periodFillings
      .filter(
        x => x.fuel === "HSD"
      )
      .reduce(
        (sum, x) =>
          sum + n(x.qty),
        0
      );

  /* ======================================================
     CURRENT STOCK
  ====================================================== */

  const ms =
    n(data.openingStock?.MS ?? 9356) +
    msFilling -
    msSale;

  const hsd =
    n(data.openingStock?.HSD ?? 7500) +
    hsdFilling -
    hsdSale;



  /* ======================================================
     ADD TANK FILLING
  ====================================================== */

  function add() {

    setMsg("");

    if (f.date < START_DATE) {

      return setMsg(
        "01-08-2026 से पहले की filling allowed नहीं है."
      );
    }

    if (!n(f.qty)) {

      return setMsg(
        "Quantity डालें."
      );
    }

    if (f.fuel !== "MS" && f.fuel !== "HSD") {
      return setMsg("Stock Filling में केवल MS या HSD allowed है। CNG यहाँ stock नहीं है।");
    }
    if (!f.purchaseRef) {
      return setMsg("Tank Filling को Purchase Bill से link करना जरूरी है।");
    }
    const bill = (data.purchases || []).find(p => purchaseRef(p) === String(f.purchaseRef));
    if (!bill) return setMsg("Selected Purchase Bill नहीं मिला।");
    if (String(bill.date) > String(f.date)) return setMsg("Filling date Purchase Bill date से पहले नहीं हो सकती।");
    const usedQty = fillingsRows.filter(x => String(x.purchaseRef) === String(f.purchaseRef)).reduce((a,x)=>a+n(x.qty),0);
    const remaining = n(bill.quantity) - usedQty;
    if (n(f.qty) > remaining + 0.001) {
      return setMsg(`Bill ${bill.invoiceNo || f.purchaseRef} में केवल ${remaining.toFixed(2)} L balance बाकी है।`);
    }

    update({
      fillings: [
        ...data.fillings,
        {
          id: Date.now(),
          date: f.date,
          fuel: f.fuel,
          qty: n(f.qty),
          purchaseRef: f.purchaseRef,
          purchaseInvoiceNo: bill.invoiceNo || "",
          purchaseDate: bill.date || "",
          linkage: "PURCHASE_LINKED"
        }
      ]
    });

    setF({
      ...f,
      qty: ""
    });

    setMsg(
      "Filling saved."
    );
  }


  return (
    <div className="content">

      {/* =================================================
          ACCOUNTING PERIOD
      ================================================= */}

      <div className="warning">

        <b>
          Accounting Period: 01-08-2026 onwards
        </b>

        <br />

        Opening Stock:
        {" "}
        MS {n(data.openingStock?.MS ?? 9356)} L
        {" | "}
        HSD {n(data.openingStock?.HSD ?? 7500)} L
        {" | "}
        <br />

        MS और HSD का Book Stock और Dip/Physical Stock अलग-अलग reconcile होगा। CNG का Stock या DIP इस module में नहीं है; CNG की purchase केवल Purchase Bill/Accounts में दर्ज होगी।

      </div>


      {dataQualityBadge}

      {/* =================================================
          CURRENT STOCK
      ================================================= */}

      <div className="cards">

        <div className="card">

          <span>
            MS Current Stock
          </span>

          <strong>
            {ms.toFixed(2)} L
          </strong>

          <small>
            Opening {n(data.openingStock?.MS ?? 9356)}
            {" + "}
            Filling {msFilling.toFixed(2)}
            {" - "}
            Sale {msSale.toFixed(2)}
          </small>

        </div>


        <div className="card">

          <span>
            HSD Current Stock
          </span>

          <strong>
            {hsd.toFixed(2)} L
          </strong>

          <small>
            Opening {n(data.openingStock?.HSD ?? 7500)}
            {" + "}
            Filling {hsdFilling.toFixed(2)}
            {" - "}
            Sale {hsdSale.toFixed(2)}
          </small>

        </div>




      </div>


      {/* =================================================
          FUEL PRICE
      ================================================= */}

      <section
        className="panel"
        style={{
          marginTop: 18
        }}
      >

        <h2>
          Current Fuel Rates
        </h2>

        <div className="total-box">

          <div className="mini">

            <span>
              MS PRICE
            </span>

            <strong>
              {money(safeRates.MS)}
              {" / Litre"}
            </strong>

          </div>


          <div className="mini">

            <span>
              HSD PRICE
            </span>

            <strong>
              {money(safeRates.HSD)}
              {" / Litre"}
            </strong>

          </div>


          <div className="mini">

            <span>
              CNG PRICE
            </span>

            <strong>
              {money(safeRates.CNG)}
              {" / Kg"}
            </strong>

          </div>


          <div className="mini">

            <span>
              ACCOUNTING START
            </span>

            <strong>
              01-08-2026
            </strong>

          </div>

        </div>

      </section>


      {/* =================================================
          DAILY STOCK RECONCILIATION
          Opp. Stock = previous day's physical dip
      ================================================= */}
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Daily Stock Reconciliation — MS / HSD</h2>
        <p>MS और HSD का Stock calculation पूरी तरह अलग है। CNG इस reconciliation और DIP से बाहर है। Fuel Sale में stored <b>Qty = Net Sale (Testing के बाद)</b> है; इसलिए Testing को दोबारा subtract नहीं किया जाता।</p>
        {[["MS","MS / Petrol"],["HSD","HSD / Diesel"]].map(([fuel,label]) => (
          <div key={fuel} style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>{label}</h3>
            <div className="table" style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Opp. Stock</th><th>Received</th><th>Total Stock</th>
                    <th>Sales By Mtr (Gross)</th><th>Pump Test</th><th>Net Sale (After Testing)</th><th>Cumm. Net Sale</th><th>Sales By Dip</th><th>Difference (Net − DIP)</th><th>Total Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStockRows.map(r => {
                    const opening = r.opening[fuel];
                    const received = r.receivedByFuel[fuel];
                    const daySalesRows = authoritativeSales.filter(x => x.date === r.date && x.fuel === fuel);
                    const net = daySalesRows.reduce((sum, x) => sum + n(x.qty), 0);
                    const pumpTest = daySalesRows.reduce((sum, x) => sum + n(x.testing), 0);
                    const meter = net + pumpTest;
                    const cumulativeFuel = dailyStockRows.filter(x => x.date <= r.date).reduce((sum, x) => {
                      return sum + authoritativeSales.filter(y => y.date === x.date && y.fuel === fuel).reduce((a, y) => a + n(y.qty), 0);
                    }, 0);
                    const salesByDip = r.salesByDip ? r.salesByDip[fuel] : null;
                    // Difference is explicitly Net Sale - Sales By Dip.
                    // Total Difference is the running/cumulative difference up to this date.
                    const difference = salesByDip === null ? null : (net - salesByDip);
                    const totalDifference = salesByDip === null ? null : dailyStockRows
                      .filter(x => x.date <= r.date)
                      .reduce((sum, x) => {
                        const dip = x.salesByDip ? x.salesByDip[fuel] : null;
                        if (dip === null || dip === undefined) return sum;
                        const dayNet = salesRows
                          .filter(y => y.date === x.date && y.fuel === fuel)
                          .reduce((a, y) => a + n(y.qty), 0);
                        return sum + (dayNet - n(dip));
                      }, 0);
                    return <tr key={`${r.date}-${fuel}`}>
                      <td><b>{r.date}</b></td>
                      <td>{opening.toFixed(2)} L</td>
                      <td>{received.toFixed(2)} L</td>
                      <td>{(opening + received).toFixed(2)} L</td>
                      <td>{meter.toFixed(2)} L</td>
                      <td>{pumpTest.toFixed(2)} L</td>
                      <td><b>{net.toFixed(2)} L</b></td>
                      <td>{cumulativeFuel.toFixed(2)} L</td>
                      <td>{salesByDip === null ? "—" : salesByDip.toFixed(2) + " L"}</td>
                      <td>{difference === null ? "—" : difference.toFixed(2) + " L"}</td>
                      <td><b>{totalDifference === null ? "—" : totalDifference.toFixed(2) + " L"}</b></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* =================================================
          DIP-WISE / PHYSICAL STOCK
      ================================================= */}
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Dip-wise Physical Stock</h2>
        <p>हर तारीख की actual physical/dip quantity दर्ज करें। Book Stock और Physical/Dip Stock का फर्क अलग से दिखेगा। Positive = Excess, Negative = Shortage. केवल MS और HSD लागू हैं।</p>

        <div className="form">
          <Field label="Date">
            <input type="date" min={START_DATE} value={dipDate} onChange={e => setDipDate(e.target.value)} />
          </Field>
          <Field label="MS Dip / Physical (L)">
            <input type="number" min="0" step="0.01" value={dipValues.MS} onChange={e => setDipValues(v => ({ ...v, MS: e.target.value }))} />
          </Field>
          <Field label="HSD Dip / Physical (L)">
            <input type="number" min="0" step="0.01" value={dipValues.HSD} onChange={e => setDipValues(v => ({ ...v, HSD: e.target.value }))} />
          </Field>
        </div>

        <div className="cards" style={{ marginTop: 12 }}>
          {[
            ["MS", "L"],
            ["HSD", "L"]
          ].map(([fuel, unit]) => {
            const physical = dipValues[fuel] === "" ? null : n(dipValues[fuel]);
            const difference = physical === null ? null : (physical - selectedBookStock[fuel]);
            return (
              <div className="card" key={fuel}>
                <span>{fuel} Book / Dip</span>
                <strong>{selectedBookStock[fuel].toFixed(2)} {unit}</strong>
                <small>Book Stock: {selectedBookStock[fuel].toFixed(2)} {unit}{physical === null ? " | Dip नहीं भरी" : ` | Dip: ${physical.toFixed(2)} ${unit} | Difference: ${difference.toFixed(2)} ${unit}`}</small>
              </div>
            );
          })}
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={saveDipReading}>💾 Save Dip Reading</button>
          <button type="button" className="btn" onClick={printDipPdf}>🖨️ Print / PDF</button>
          <button type="button" className="btn" onClick={exportDipExcel}>📊 Excel</button>
          <button type="button" className="btn" onClick={shareDipWhatsApp}>💬 WhatsApp</button>
        </div>
        {dipMsg && <div className={dipMsg.includes("saved") ? "notice" : "notice error"}>{dipMsg}</div>}

        <div className="table" style={{ marginTop: 18 }}>
          <table>
            <thead><tr><th>Date</th><th>MS Dip (L)</th><th>MS Diff</th><th>HSD Dip (L)</th><th>HSD Diff</th></tr></thead>
            <tbody>
              {(Array.isArray(data.dipReadings) ? data.dipReadings.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))) : []).map(r => {
                const book = bookStockAsOf(r.date);
                return <tr key={r.id ?? r.date}>
                  <td><b>{r.date}</b></td>
                  <td>{n(r.MS).toFixed(2)}</td><td>{(n(r.MS) - book.MS).toFixed(2)} L</td>
                  <td>{n(r.HSD).toFixed(2)}</td><td>{(n(r.HSD) - book.HSD).toFixed(2)} L</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          RATE MANAGEMENT
      ================================================= */}
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Update Fuel Rates</h2>
        <p>
          Effective Date से उस तारीख की नई Sale में नया rate लागू होगा।
          पुरानी saved Sale का rate नहीं बदलेगा।
        </p>

        <div className="form">
          <Field label="Effective Date">
            <input
              type="date"
              min={START_DATE}
              value={rateDate}
              onChange={e => setRateDate(e.target.value)}
            />
          </Field>

          <Field label="MS Rate ₹/Litre">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={String(getRate(data, "MS", rateDate))}
              value={newMSRate}
              onChange={e => setNewMSRate(e.target.value)}
            />
          </Field>

          <Field label="HSD Rate ₹/Litre">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={String(getRate(data, "HSD", rateDate))}
              value={newHSDRate}
              onChange={e => setNewHSDRate(e.target.value)}
            />
          </Field>

          <Field label="CNG Rate ₹/Kg">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={String(getRate(data, "CNG", rateDate))}
              value={newCNGRate}
              onChange={e => setNewCNGRate(e.target.value)}
            />
          </Field>
        </div>

        <div className="actions">
          <button className="btn" onClick={updateFuelRates}>
            💾 Save Effective Rate
          </button>
        </div>

        {msg && (
          <div className={msg.includes("Rate saved") ? "notice" : "notice error"}>
            {msg}
          </div>
        )}

        <div className="table" style={{ marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>Effective Date</th>
                <th>MS ₹/L</th>
                <th>HSD ₹/L</th>
                <th>CNG ₹/Kg</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(data.rateHistory) ? data.rateHistory.slice().sort((a,b) =>
                String(b.date).localeCompare(String(a.date))
              ) : []).map(r => (
                <tr key={r.id ?? r.date}>
                  <td><b>{r.date}</b></td>
                  <td>{money(r.MS)}</td>
                  <td>{money(r.HSD)}</td>
                  <td>{money(r.CNG)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================
          TANK FILLING
      ================================================= */}

      <section
        className="panel"
        style={{
          marginTop: 18
        }}
      >

        <h2>
          Tank Filling
        </h2>

        <div className="form">

          <Field label="Fuel">

            <select
              value={f.fuel}
              onChange={e =>
                setF({
                  ...f,
                  fuel: e.target.value
                })
              }
            >

              <option value="MS">
                MS
              </option>

              <option value="HSD">
                HSD
              </option>

            </select>

          </Field>


          <Field label="HPCL Purchase Bill">
            <select
              value={f.purchaseRef}
              onChange={e => setF({ ...f, purchaseRef: e.target.value })}
            >
              <option value="">— Select Purchase Bill —</option>
              {(data.purchases || []).filter(p => p.fuel === f.fuel && String(p.date) <= String(f.date)).map(p => {
                const ref = purchaseRef(p);
                const used = fillingsRows.filter(x => String(x.purchaseRef) === ref).reduce((a,x)=>a+n(x.qty),0);
                const remaining = n(p.quantity) - used;
                return <option key={ref} value={ref} disabled={remaining <= 0.001}>
                  {p.date} · {p.invoiceNo || ref} · {n(p.quantity).toFixed(2)} L · Balance {Math.max(0,remaining).toFixed(2)} L
                </option>;
              })}
            </select>
          </Field>

          <Field label="Quantity">

            <input
              type="number"
              step=".01"
              value={f.qty}
              onChange={e =>
                setF({
                  ...f,
                  qty: e.target.value
                })
              }
            />

          </Field>


          <Field label="Date">

            <input
              type="date"
              min={START_DATE}
              value={f.date}
              onChange={e =>
                setF({
                  ...f,
                  date: e.target.value
                })
              }
            />

          </Field>

        </div>


        <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'#eff6ff',border:'1px solid #bfdbfe',fontSize:12}}>
          <b>Inventory chain:</b> Purchase Bill → linked Tank Receipt/Filling → Book Stock → Sale/COGS. Existing exact-match fillings are auto-linked; new fillings cannot exceed the selected bill's remaining quantity.
        </div>

        <div className="actions">

          <button
            className="btn"
            onClick={add}
          >
            ＋ Add Filling
          </button>

        </div>


        {msg && (
          <div className="notice">
            {msg}
          </div>
        )}

      </section>


      {/* =================================================
          TANK FILLING REGISTER
      ================================================= */}

      <section
        className="panel"
        style={{
          marginTop: 18
        }}
      >

        <h2>
          Tank Filling Register
        </h2>

        <Table

          headers={[
            "Date",
            "Fuel",
            "Qty",
            "Purchase Bill",
            "Link Status",
            "Purchase Rate",
            "Amount"
          ]}

          rows={
            data.fillings
              .filter(x => x.fuel === "MS" || x.fuel === "HSD")
              .slice()
              .reverse()
              .map(x => [

                x.date,

                x.fuel,

                x.qty,

                x.purchaseInvoiceNo || "—",

                x.purchaseRef ? "LINKED" : "LEGACY / UNLINKED",

                money(getPurchaseRate(data, x.fuel, x.date)),

                money(
                  n(x.qty) * getPurchaseRate(data, x.fuel, x.date)
                )

              ])
          }

        />

      </section>

    </div>
  );
}


/* =========================================================
   COMMON FIELD
========================================================= */

export function Field({
  label,
  children
}) {
  return (
    <label className="field">

      <span>
        {label}
      </span>

      {children}

    </label>
  );
}


/* =========================================================
   COMMON TABLE
========================================================= */

export function Table({
  headers,
  rows,
  onEdit,
  onDelete,
  onPrintBill,
  showPrintBill,
  rowIds = []
}) {

  const hasActions = !!(onEdit || onDelete || onPrintBill);

  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={String(h)}>
                {h}
              </th>
            ))}
            {hasActions && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={rowIds[i] ?? i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
                {hasActions && (
                  <td>
                    {onEdit && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() =>
                          onEdit(
                            rowIds[i] ?? i,
                            r,
                            i
                          )
                        }
                      >
                        ✏️ Edit
                      </button>
                    )}
                    {onPrintBill && (!showPrintBill || showPrintBill(rowIds[i] ?? i, r, i)) && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => onPrintBill(rowIds[i] ?? i, r, i)}
                      >
                        🧾 Sale Bill
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="btn red small"
                        onClick={() =>
                          onDelete(
                            rowIds[i] ?? i,
                            r,
                            i
                          )
                        }
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={
                  headers.length +
                  (hasActions ? 1 : 0)
                }
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}