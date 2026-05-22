// ==========================================
// MOLD HISTORY PAGE
// ==========================================

function MoldHistoryPage({ user, showToast }) {
    const h = React.createElement;
    const [searchQuery, setSearchQuery] = React.useState('');
    const [moldResults, setMoldResults] = React.useState([]);
    const [showResults, setShowResults] = React.useState(false);
    
    const [selectedMold, setSelectedMold] = React.useState(null);
    const [pmRecords, setPmRecords] = React.useState([]);
    const [inspRecords, setInspRecords] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [selectedRecordModal, setSelectedRecordModal] = React.useState(null);
    const [modalType, setModalType] = React.useState('pm'); // 'pm' | 'inspection'

    // Auto-search logic when typing
    React.useEffect(() => {
        if (!searchQuery.trim()) {
            setMoldResults([]);
            return;
        }
        
        const fetchMolds = async () => {
            try {
                if (window.supabaseClient) {
                    const q = searchQuery.toLowerCase();
                    const { data } = await window.supabaseClient
                        .from('mold_master')
                        .select('mold_code, mold_name, vendor, dwg_part1')
                        .or(`mold_code.ilike.%${q}%,dwg_part1.ilike.%${q}%`)
                        .limit(10);
                    setMoldResults(data || []);
                }
            } catch (err) {
                console.error(err);
            }
        };
        
        const timer = setTimeout(fetchMolds, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Helper: compute doc_no for a list of records (sorted by created_at asc) 
    const computeDocNos = (records, prefix) => {
        const sorted = [...records].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        const counters = {};
        return sorted.map(r => {
            const dateStr = (r.performed_date || (r.created_at || '').split('T')[0]).replace(/-/g, '');
            if (!counters[dateStr]) counters[dateStr] = 1;
            else counters[dateStr]++;
            return { ...r, doc_no: `${prefix}-${dateStr}-${String(counters[dateStr]).padStart(4, '0')}` };
        }).sort((a, b) => new Date(b.performed_date) - new Date(a.performed_date));
    };

    const handleSearchClick = async () => {
        if (!searchQuery.trim()) return;
        
        setLoading(true);
        setSelectedMold(null);
        setShowResults(false);
        
        try {
            if (window.supabaseClient) {
                const q = searchQuery.toLowerCase();
                const { data: moldData } = await window.supabaseClient
                    .from('mold_master')
                    .select('*')
                    .or(`mold_code.eq.${searchQuery},dwg_part1.eq.${searchQuery},mold_code.ilike.%${q}%,dwg_part1.ilike.%${q}%`)
                    .limit(1);
                    
                if (!moldData || moldData.length === 0) {
                    showToast('ไม่พบข้อมูลแม่พิมพ์รหัสนี้', 'warning');
                    setLoading(false);
                    return;
                }
                
                const mold = moldData[0];
                setSelectedMold(mold);
                
                const [pmRes, inspRes] = await Promise.all([
                    window.supabaseClient
                        .from('pm_checklist_records')
                        .select('*')
                        .eq('mold_code', mold.mold_code)
                        .order('created_at', { ascending: true }),
                    window.supabaseClient
                        .from('inspection_records')
                        .select('*')
                        .eq('mold_code', mold.mold_code)
                        .order('created_at', { ascending: true })
                ]);
                
                setPmRecords(computeDocNos(pmRes.data || [], 'RTE-PM'));
                setInspRecords(computeDocNos(inspRes.data || [], 'RTE-INSP'));
            }
        } catch (err) {
            console.error('Search error', err);
            showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectResult = (mold) => {
        setSearchQuery(mold.mold_code);
        setShowResults(false);
    };
    
    // ----------------------------------------------------------------
    // Status Badge helper
    // ----------------------------------------------------------------
    const getStatusBadge = (status) => {
        const badges = {
            'completed': { class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'fa-check-circle', label: 'Completed' },
            'pending':   { class: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   icon: 'fa-clock',            label: 'Pending'   },
            'failed':    { class: 'bg-rose-500/10 text-rose-400 border-rose-500/20',       icon: 'fa-triangle-exclamation', label: 'Failed' },
        };
        const config = badges[status?.toLowerCase()] || { class: 'bg-surface-500/10 text-surface-400 border-surface-500/20', icon: 'fa-circle-dot', label: status || 'Unknown' };
        return h('span', { className: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.class}` },
            h('i', { className: `fa-solid ${config.icon}` }), config.label
        );
    };

    const getTypeInfo = (id) => (window.CHECKLIST_TYPES || []).find(t => t.id === id) || { label: 'Level ' + (id || 1), icon: 'fa-list', color: 'from-gray-500 to-gray-600' };

    // ----------------------------------------------------------------
    // PDF: single record (same style as PM Summary page)
    // ----------------------------------------------------------------
    const downloadRecordPDF = (record, isPm) => {
        if (!window.html2pdf) { showToast('กำลังโหลดไลบรารี PDF กรุณารอสักครู่', 'warning'); return; }
        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        const typeInfo = isPm ? getTypeInfo(record.pm_level) : { label: `Type ${record.pm_level || 1}` };
        const prefix = isPm ? 'PREVENTIVE MAINTENANCE CHECK SHEET' : 'INSPECTION CHECK SHEET';

        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:-9999px;top:0;';
        container.innerHTML = `
        <div id="pdf-rec-content" style="padding:30px 40px;font-family:'Inter','Noto Sans Thai',sans-serif;color:#1a1a1a;font-size:10px;width:794px;min-height:1122px;box-sizing:border-box;background:white;position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:10px;">
                <div>
                    <h1 style="margin:0;font-size:16px;color:#000;font-weight:800;">${prefix}</h1>
                    <p style="margin:2px 0 0;color:#666;font-size:10px;">ระบบจัดการงานบำรุงรักษาแม่พิมพ์ (PM Mold RTE)</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold;color:#4f46e5;font-size:12px;">${typeInfo.label}</div>
                    <div style="font-size:9px;color:#666;">DOC NO: ${record.doc_no || '-'}</div>
                </div>
            </div>
            <div style="display:flex;gap:15px;margin-bottom:10px;background:#fcfcfc;padding:8px;border:1px solid #eee;border-radius:4px;">
                <div style="flex:1;">
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">Mold Code:</span><span style="font-weight:700;flex:1;border-bottom:1px dotted #ccc;">${record.mold_code||'-'}</span></div>
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">Mold Name:</span><span style="flex:1;border-bottom:1px dotted #ccc;">${selectedMold?.mold_name||'-'}</span></div>
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">DWG Part:</span><span style="flex:1;border-bottom:1px dotted #ccc;">${selectedMold?.dwg_part1||'-'}</span></div>
                </div>
                <div style="flex:1;">
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">Category:</span><span style="flex:1;border-bottom:1px dotted #ccc;">${record.category_name||'-'}</span></div>
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">Performed By:</span><span style="flex:1;border-bottom:1px dotted #ccc;">${record.performed_by||'-'}</span></div>
                    <div style="display:flex;margin-bottom:3px;"><span style="font-weight:bold;width:90px;color:#555;">Date:</span><span style="flex:1;border-bottom:1px dotted #ccc;">${record.performed_date||'-'}</span></div>
                </div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;table-layout:fixed;">
                <thead>
                    <tr>
                        <th style="width:30px;background:#f0f0f0;text-align:left;padding:4px 6px;border:1px solid #333;font-size:10px;">No.</th>
                        <th style="width:90px;background:#f0f0f0;text-align:left;padding:4px 6px;border:1px solid #333;font-size:10px;">Category</th>
                        <th style="background:#f0f0f0;text-align:left;padding:4px 6px;border:1px solid #333;font-size:10px;">Inspection Item / รายการตรวจสอบ</th>
                        <th style="width:60px;text-align:center;background:#f0f0f0;padding:4px 6px;border:1px solid #333;font-size:10px;">Result</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((item, idx) => `
                        <tr>
                            <td style="text-align:center;padding:3px 6px;border:1px solid #333;">${idx+1}</td>
                            <td style="color:#666;font-size:9px;padding:3px 6px;border:1px solid #333;">${item.category||'-'}</td>
                            <td style="padding:3px 6px;border:1px solid #333;">${item.name}</td>
                            <td style="text-align:center;padding:3px 6px;border:1px solid #333;">
                                <span style="font-weight:bold;text-transform:uppercase;padding:1px 4px;border:1px solid #333;font-size:8px;display:inline-block;background:${item.result==='pass'?'#d1fae5':item.result==='fail'?'#fee2e2':'#f3f4f6'};">${item.result||'N/A'}</span>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>
            <div style="margin-top:5px;padding:6px;border:1px solid #333;min-height:36px;">
                <div style="font-weight:bold;margin-bottom:2px;">Additional Notes / หมายเหตุ:</div>
                <div style="font-size:9px;">${record.notes||'-'}</div>
            </div>
            <div style="position:absolute;bottom:40px;left:40px;right:40px;display:flex;justify-content:space-between;gap:40px;">
                <div style="flex:1;border-top:1px solid #000;text-align:center;padding-top:5px;font-size:10px;">
                    <p style="margin-bottom:25px;">Performed By (ผู้ตรวจสอบ)</p>
                    <p>${record.performed_by}</p>
                    <p style="font-size:8px;color:#666;">Date: ${record.performed_date}</p>
                </div>
                <div style="flex:1;border-top:1px solid #000;text-align:center;padding-top:5px;font-size:10px;">
                    <p style="margin-bottom:25px;">Approved By (ผู้อนุมัติ)</p>
                    <p style="color:#ccc;">__________________________</p>
                    <p style="font-size:8px;color:#666;">Date: ____/____/____</p>
                </div>
            </div>
        </div>`;
        document.body.appendChild(container);
        const el = document.getElementById('pdf-rec-content');
        const opt = {
            margin: 0,
            filename: `${isPm?'PM':'INSP'}_Record_${record.mold_code}_${record.performed_date}_${record.doc_no||'doc'}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        showToast('กำลังประมวลผล PDF...', 'info');
        window.html2pdf().set(opt).from(el).save().then(() => {
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF สำเร็จ', 'success');
        }).catch(err => {
            console.error('PDF error', err);
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF ล้มเหลว', 'error');
        });
    };

    // ----------------------------------------------------------------
    // Excel (CSV): single record
    // ----------------------------------------------------------------
    const downloadRecordExcel = (record, isPm) => {
        const data = Array.isArray(record.checklist_data) ? record.checklist_data : [];
        const prefix = isPm ? 'PM Check Sheet' : 'Inspection Check Sheet';
        let csv = '\uFEFF';
        csv += `${prefix}: ${record.mold_code} (${selectedMold?.mold_name||''})\n`;
        csv += `DOC NO: ${record.doc_no||'-'}\n`;
        csv += `Category: ${record.category_name||'-'}, Level: ${record.pm_level||1}\n`;
        csv += `Performed By: ${record.performed_by||'-'}, Date: ${record.performed_date||'-'}\n\n`;
        csv += 'No.,Category,Inspection Item,Result\n';
        data.forEach((item, idx) => {
            csv += `${idx+1},"${item.category||''}","${item.name}","${item.result||'N/A'}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${isPm?'PM':'INSP'}_Record_${record.mold_code}_${record.performed_date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ----------------------------------------------------------------
    // Summary PDF: all PM records for this mold (beautiful multi-record layout)
    // ----------------------------------------------------------------
    const downloadSummaryPDF = (records, isPm) => {
        if (!window.html2pdf) { showToast('กำลังโหลดไลบรารี PDF', 'warning'); return; }
        if (records.length === 0) { showToast('ไม่มีข้อมูลที่จะสร้าง PDF', 'warning'); return; }
        const label = isPm ? 'PM History Report' : 'Inspection History Report';
        const prefix = isPm ? 'RTE-PM' : 'RTE-INSP';

        const rows = records.map((r, idx) => `
            <tr style="background:${idx%2===0?'#fff':'#f9fafb'};">
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">${idx+1}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;white-space:nowrap;">${r.performed_date||'-'}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;font-weight:600;color:#4f46e5;">${r.doc_no||'-'}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">${r.category_name||'-'}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">${isPm?'Level '+(r.pm_level||1):'Type '+(r.pm_level||1)}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">${r.performed_by||'-'}</td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">
                    ${(r.checklist_data||[]).filter(i=>i.result==='pass').length} / ${(r.checklist_data||[]).length}
                </td>
                <td style="padding:5px 8px;border:1px solid #ddd;font-size:9px;">
                    <span style="font-weight:bold;color:${(r.checklist_data||[]).some(i=>i.result==='fail')?'#dc2626':'#16a34a'};">
                        ${(r.checklist_data||[]).some(i=>i.result==='fail')?'FAIL':'PASS'}
                    </span>
                </td>
            </tr>`).join('');

        const passCount = records.filter(r => !(r.checklist_data||[]).some(i=>i.result==='fail')).length;
        const failCount = records.length - passCount;
        const today = new Date().toLocaleDateString('th-TH', { year:'numeric', month:'long', day:'numeric' });

        const container = document.createElement('div');
        container.style.cssText = 'position:absolute;left:-9999px;top:0;';
        container.innerHTML = `
        <div id="pdf-summary-content" style="padding:30px 40px;font-family:'Inter','Noto Sans Thai',sans-serif;color:#1a1a1a;font-size:10px;width:1122px;min-height:794px;box-sizing:border-box;background:white;position:relative;">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:16px;">
                <div>
                    <div style="font-size:8px;color:#4f46e5;font-weight:700;letter-spacing:2px;margin-bottom:4px;">PM MOLD RTE SYSTEM</div>
                    <h1 style="margin:0;font-size:20px;color:#000;font-weight:900;">${label}</h1>
                    <p style="margin:4px 0 0;color:#666;font-size:10px;">สรุปประวัติการ${isPm?'บำรุงรักษา':'ตรวจสอบ'}แม่พิมพ์ทั้งหมด</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:9px;color:#666;">วันที่พิมพ์ / Print Date</div>
                    <div style="font-weight:bold;font-size:11px;">${today}</div>
                </div>
            </div>
            <!-- Mold Info -->
            <div style="background:#f0f0ff;border:1px solid #c7d2fe;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:flex;gap:40px;">
                <div>
                    <div style="font-size:8px;color:#6366f1;font-weight:700;text-transform:uppercase;margin-bottom:2px;">Mold Code / รหัสแม่พิมพ์</div>
                    <div style="font-size:18px;font-weight:900;color:#000;">${selectedMold?.mold_code||'-'}</div>
                </div>
                <div>
                    <div style="font-size:8px;color:#6366f1;font-weight:700;text-transform:uppercase;margin-bottom:2px;">Mold Name / ชื่อแม่พิมพ์</div>
                    <div style="font-size:14px;font-weight:700;color:#1e1b4b;">${selectedMold?.mold_name||'-'}</div>
                </div>
                <div>
                    <div style="font-size:8px;color:#6366f1;font-weight:700;text-transform:uppercase;margin-bottom:2px;">DWG / Part</div>
                    <div style="font-size:12px;font-weight:600;color:#333;">${selectedMold?.dwg_part1||'-'}</div>
                </div>
                <div>
                    <div style="font-size:8px;color:#6366f1;font-weight:700;text-transform:uppercase;margin-bottom:2px;">Vendor</div>
                    <div style="font-size:12px;font-weight:600;color:#333;">${selectedMold?.vendor||'-'}</div>
                </div>
            </div>
            <!-- Stats -->
            <div style="display:flex;gap:12px;margin-bottom:16px;">
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;text-align:center;">
                    <div style="font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;">Total Records</div>
                    <div style="font-size:24px;font-weight:900;color:#4f46e5;">${records.length}</div>
                </div>
                <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;text-align:center;">
                    <div style="font-size:8px;color:#16a34a;font-weight:700;text-transform:uppercase;">Pass</div>
                    <div style="font-size:24px;font-weight:900;color:#16a34a;">${passCount}</div>
                </div>
                <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;text-align:center;">
                    <div style="font-size:8px;color:#dc2626;font-weight:700;text-transform:uppercase;">Fail</div>
                    <div style="font-size:24px;font-weight:900;color:#dc2626;">${failCount}</div>
                </div>
                <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;text-align:center;">
                    <div style="font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;">Pass Rate</div>
                    <div style="font-size:24px;font-weight:900;color:#0891b2;">${records.length?Math.round(passCount/records.length*100):0}%</div>
                </div>
            </div>
            <!-- Table -->
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                <thead>
                    <tr style="background:#4f46e5;">
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">#</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">Date</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">Doc No.</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">Category</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">Level</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:left;">Performed By</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:center;">Pass/Total</th>
                        <th style="padding:7px 8px;border:1px solid #4f46e5;font-size:9px;color:#fff;text-align:center;">Status</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <!-- Signatures -->
            <div style="display:flex;justify-content:space-between;gap:60px;margin-top:20px;">
                <div style="flex:1;border-top:1px solid #000;text-align:center;padding-top:5px;font-size:10px;">
                    <p style="margin-bottom:30px;">Prepared By (ผู้จัดทำ)</p>
                    <p style="font-size:8px;color:#666;">Date: ____/____/____</p>
                </div>
                <div style="flex:1;border-top:1px solid #000;text-align:center;padding-top:5px;font-size:10px;">
                    <p style="margin-bottom:30px;">Reviewed By (ผู้ตรวจสอบ)</p>
                    <p style="font-size:8px;color:#666;">Date: ____/____/____</p>
                </div>
                <div style="flex:1;border-top:1px solid #000;text-align:center;padding-top:5px;font-size:10px;">
                    <p style="margin-bottom:30px;">Approved By (ผู้อนุมัติ)</p>
                    <p style="font-size:8px;color:#666;">Date: ____/____/____</p>
                </div>
            </div>
        </div>`;
        document.body.appendChild(container);
        const el = document.getElementById('pdf-summary-content');
        const opt = {
            margin: 0,
            filename: `${isPm?'PM':'INSP'}_Summary_${selectedMold?.mold_code}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        showToast('กำลังสร้าง PDF สรุป...', 'info');
        window.html2pdf().set(opt).from(el).save().then(() => {
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF สรุปสำเร็จ', 'success');
        }).catch(err => {
            console.error('PDF error', err);
            document.body.removeChild(container);
            showToast('ดาวน์โหลด PDF ล้มเหลว', 'error');
        });
    };

    // ----------------------------------------------------------------
    // Summary Excel (CSV): all records for this mold
    // ----------------------------------------------------------------
    const downloadSummaryExcel = (records, isPm) => {
        if (records.length === 0) { showToast('ไม่มีข้อมูลที่จะส่งออก', 'warning'); return; }
        let csv = '\uFEFF';
        csv += `${isPm?'PM':'Inspection'} History Summary: ${selectedMold?.mold_code} (${selectedMold?.mold_name||''})\n`;
        csv += `DWG: ${selectedMold?.dwg_part1||'-'}, Vendor: ${selectedMold?.vendor||'-'}\n\n`;
        csv += 'No.,Date,Doc No.,Category,Level,Performed By,Pass,Total,Status\n';
        records.forEach((r, idx) => {
            const passItems = (r.checklist_data||[]).filter(i=>i.result==='pass').length;
            const totalItems = (r.checklist_data||[]).length;
            const status = (r.checklist_data||[]).some(i=>i.result==='fail') ? 'FAIL' : 'PASS';
            csv += `${idx+1},"${r.performed_date||''}","${r.doc_no||''}","${r.category_name||''}","${isPm?'Level ':'Type '}${r.pm_level||1}","${r.performed_by||''}",${passItems},${totalItems},${status}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${isPm?'PM':'INSP'}_Summary_${selectedMold?.mold_code}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ----------------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------------
    return h('div', { className: 'space-y-6 animate-fade-in pb-8 max-w-7xl mx-auto' },
        // TOP SEARCH BAR
        h('div', { className: 'card flex flex-col md:flex-row md:items-center justify-between gap-4 p-4' },
            h('div', null,
                h('h2', { className: 'text-2xl font-black text-white tracking-tight' }, 'Mold History'),
                h('p', { className: 'text-sm text-surface-400 mt-1 font-medium' }, 'ค้นหาและดูประวัติแม่พิมพ์/ชิ้นงานรายตัว')
            ),
            h('div', { className: 'flex flex-1 max-w-md relative gap-2' },
                h('div', { className: 'relative flex-1' },
                    h('input', {
                        type: 'text',
                        className: 'input pl-10 bg-surface-900 border-white/10 w-full',
                        placeholder: 'พิมพ์รหัสแม่พิมพ์ (Asset1) หรือรหัสชิ้นงาน (DWG)',
                        value: searchQuery,
                        onChange: e => { setSearchQuery(e.target.value); setShowResults(true); },
                        onFocus: () => setShowResults(true),
                        onKeyDown: e => { if (e.key === 'Enter') handleSearchClick(); }
                    }),
                    h('i', { className: 'fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-500' }),
                    showResults && moldResults.length > 0 && h('div', { className: 'absolute z-50 left-0 right-0 mt-2 bg-surface-800 rounded-lg shadow-xl border border-white/10 overflow-hidden' },
                        moldResults.map(m => h('div', {
                            key: m.mold_code,
                            className: 'p-3 hover:bg-surface-700 cursor-pointer flex justify-between items-center transition-colors border-b border-white/5 last:border-0',
                            onClick: () => handleSelectResult(m)
                        },
                            h('div', null,
                                h('p', { className: 'text-sm font-bold text-white' }, m.mold_code),
                                h('p', { className: 'text-xs text-surface-400' }, `${m.mold_name} [${m.dwg_part1 || '-'}]`)
                            ),
                            h('span', { className: 'text-[10px] text-primary-500 font-bold bg-primary-500/10 px-2 py-0.5 rounded' }, m.vendor)
                        ))
                    )
                ),
                h('button', {
                    className: 'btn btn-primary px-6 whitespace-nowrap',
                    onClick: handleSearchClick,
                    disabled: loading
                }, loading ? h('i', { className: 'fa-solid fa-spinner fa-spin' }) : 'ค้นหา')
            )
        ),

        loading && h('div', { className: 'flex items-center justify-center py-20' }, h('div', { className: 'loading-spinner' })),

        !loading && !selectedMold && searchQuery === '' && h('div', { className: 'card flex flex-col items-center justify-center py-20 text-surface-500 border-dashed' },
            h('i', { className: 'fa-solid fa-clock-rotate-left text-4xl mb-4 opacity-50' }),
            h('p', { className: 'text-lg font-semibold' }, 'ระบุรหัสแม่พิมพ์หรือชิ้นงานเพื่อดูประวัติ')
        ),

        !loading && selectedMold && h('div', { className: 'space-y-6 animate-fade-in-up' },
            // MOLD SUMMARY CARD
            h('div', { className: 'card p-6 border border-white/5' },
                h('div', { className: 'flex flex-col md:flex-row gap-8' },
                    h('div', { className: 'flex-1' },
                        h('span', { className: 'badge badge-primary text-xs mb-3' }, 'Mold Information'),
                        h('h3', { className: 'text-3xl font-black text-white mb-1' }, selectedMold.mold_code),
                        h('p', { className: 'text-lg text-primary-300 font-medium mb-6' }, selectedMold.mold_name || 'No Name'),
                        h('div', { className: 'grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8' },
                            h('div', null, h('p', { className: 'text-xs text-surface-500 font-bold uppercase mb-1' }, 'DWG / Part'), h('p', { className: 'font-semibold text-white' }, selectedMold.dwg_part1 || '-')),
                            h('div', null, h('p', { className: 'text-xs text-surface-500 font-bold uppercase mb-1' }, 'Vendor'), h('p', { className: 'font-semibold text-white' }, selectedMold.vendor || '-')),
                            h('div', null, h('p', { className: 'text-xs text-surface-500 font-bold uppercase mb-1' }, 'Customer'), h('p', { className: 'font-semibold text-white' }, selectedMold.customer || '-'))
                        )
                    ),
                    h('div', { className: 'flex flex-row md:flex-col gap-4' },
                        h('div', { className: 'bg-surface-800 p-4 rounded-xl border border-white/5 w-40 text-center' },
                            h('p', { className: 'text-xs text-surface-400 font-bold uppercase mb-2' }, 'Total PMs'),
                            h('p', { className: 'text-3xl font-black text-indigo-400' }, pmRecords.length)
                        ),
                        h('div', { className: 'bg-surface-800 p-4 rounded-xl border border-white/5 w-40 text-center' },
                            h('p', { className: 'text-xs text-surface-400 font-bold uppercase mb-2' }, 'Total Inspections'),
                            h('p', { className: 'text-3xl font-black text-cyan-400' }, inspRecords.length)
                        )
                    )
                )
            ),

            // EXPORT BUTTONS ROW
            h('div', { className: 'flex flex-wrap gap-3' },
                h('div', { className: 'flex items-center gap-2 mr-4' },
                    h('i', { className: 'fa-solid fa-screwdriver-wrench text-indigo-400 text-xs' }),
                    h('span', { className: 'text-xs font-bold text-indigo-400 uppercase' }, 'PM Report:')
                ),
                h('button', {
                    className: 'btn btn-sm bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30',
                    onClick: () => downloadSummaryPDF(pmRecords, true),
                    disabled: pmRecords.length === 0
                }, h('i', { className: 'fa-solid fa-file-pdf mr-2' }), 'PDF Summary (PM)'),
                h('button', {
                    className: 'btn btn-sm bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30',
                    onClick: () => downloadSummaryExcel(pmRecords, true),
                    disabled: pmRecords.length === 0
                }, h('i', { className: 'fa-solid fa-file-excel mr-2' }), 'Excel Summary (PM)'),
                h('div', { className: 'w-px h-6 bg-white/10 self-center mx-2' }),
                h('div', { className: 'flex items-center gap-2 mr-2' },
                    h('i', { className: 'fa-solid fa-magnifying-glass-chart text-cyan-400 text-xs' }),
                    h('span', { className: 'text-xs font-bold text-cyan-400 uppercase' }, 'Inspection Report:')
                ),
                h('button', {
                    className: 'btn btn-sm bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30',
                    onClick: () => downloadSummaryPDF(inspRecords, false),
                    disabled: inspRecords.length === 0
                }, h('i', { className: 'fa-solid fa-file-pdf mr-2' }), 'PDF Summary (Inspection)'),
                h('button', {
                    className: 'btn btn-sm bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30',
                    onClick: () => downloadSummaryExcel(inspRecords, false),
                    disabled: inspRecords.length === 0
                }, h('i', { className: 'fa-solid fa-file-excel mr-2' }), 'Excel Summary (Inspection)')
            ),

            // HISTORY LISTS
            h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-6' },
                // PM History
                h('div', { className: 'card p-0 overflow-hidden flex flex-col h-[600px]' },
                    h('div', { className: 'p-4 border-b border-white/5 bg-surface-900/50 flex justify-between items-center' },
                        h('div', { className: 'flex items-center gap-2 text-indigo-400' },
                            h('i', { className: 'fa-solid fa-screwdriver-wrench' }),
                            h('h3', { className: 'font-bold' }, 'PM History')
                        ),
                        h('span', { className: 'text-xs text-surface-400 font-semibold' }, pmRecords.length + ' records')
                    ),
                    h('div', { className: 'flex-1 overflow-y-auto' },
                        pmRecords.length === 0
                            ? h('p', { className: 'text-center text-surface-500 py-10' }, 'ไม่มีประวัติ PM')
                            : pmRecords.map(r => h('div', { key: r.id, className: 'flex items-center gap-2 p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors' },
                                h('div', { className: 'w-24 text-surface-400 text-xs shrink-0' }, r.performed_date),
                                h('div', { className: 'w-16 font-semibold text-indigo-400 text-[10px] shrink-0' }, `Level ${r.pm_level || 1}`),
                                h('div', { className: 'flex-1 text-white truncate text-xs' }, h('i', { className: 'fa-solid fa-user text-surface-500 mr-1.5 text-[10px]' }), r.performed_by),
                                h('div', { className: 'shrink-0' }, getStatusBadge(r.status)),
                                h('div', { className: 'flex gap-1 shrink-0' },
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10',
                                        title: 'Download PDF',
                                        onClick: () => downloadRecordPDF(r, true)
                                    }, h('i', { className: 'fa-solid fa-file-pdf text-[10px]' })),
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-emerald-400 hover:bg-emerald-500/10',
                                        title: 'Download Excel',
                                        onClick: () => downloadRecordExcel(r, true)
                                    }, h('i', { className: 'fa-solid fa-file-excel text-[10px]' })),
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-primary-400 hover:bg-primary-500/10',
                                        title: 'View Details',
                                        onClick: () => { setSelectedRecordModal(r); setModalType('pm'); }
                                    }, h('i', { className: 'fa-solid fa-eye text-[10px]' }))
                                )
                            ))
                    )
                ),

                // Inspection History
                h('div', { className: 'card p-0 overflow-hidden flex flex-col h-[600px]' },
                    h('div', { className: 'p-4 border-b border-white/5 bg-surface-900/50 flex justify-between items-center' },
                        h('div', { className: 'flex items-center gap-2 text-cyan-400' },
                            h('i', { className: 'fa-solid fa-magnifying-glass-chart' }),
                            h('h3', { className: 'font-bold' }, 'Inspection History')
                        ),
                        h('span', { className: 'text-xs text-surface-400 font-semibold' }, inspRecords.length + ' records')
                    ),
                    h('div', { className: 'flex-1 overflow-y-auto' },
                        inspRecords.length === 0
                            ? h('p', { className: 'text-center text-surface-500 py-10' }, 'ไม่มีประวัติ Inspection')
                            : inspRecords.map(r => h('div', { key: r.id, className: 'flex items-center gap-2 p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors' },
                                h('div', { className: 'w-24 text-surface-400 text-xs shrink-0' }, r.performed_date),
                                h('div', { className: 'w-16 font-semibold text-cyan-400 text-[10px] shrink-0' }, `Type ${r.pm_level || 1}`),
                                h('div', { className: 'flex-1 text-white truncate text-xs' }, h('i', { className: 'fa-solid fa-user text-surface-500 mr-1.5 text-[10px]' }), r.performed_by),
                                h('div', { className: 'shrink-0' }, getStatusBadge(r.status)),
                                h('div', { className: 'flex gap-1 shrink-0' },
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10',
                                        title: 'Download PDF',
                                        onClick: () => downloadRecordPDF(r, false)
                                    }, h('i', { className: 'fa-solid fa-file-pdf text-[10px]' })),
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-emerald-400 hover:bg-emerald-500/10',
                                        title: 'Download Excel',
                                        onClick: () => downloadRecordExcel(r, false)
                                    }, h('i', { className: 'fa-solid fa-file-excel text-[10px]' })),
                                    h('button', {
                                        className: 'btn btn-ghost btn-xs text-primary-400 hover:bg-primary-500/10',
                                        title: 'View Details',
                                        onClick: () => { setSelectedRecordModal(r); setModalType('inspection'); }
                                    }, h('i', { className: 'fa-solid fa-eye text-[10px]' }))
                                )
                            ))
                    )
                )
            )
        ),

        // ---- RECORD DETAILS MODAL ----
        selectedRecordModal && h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in' },
            h('div', { className: 'card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/10' },
                // Modal Header
                h('div', { className: 'flex justify-between items-start p-6 border-b border-white/5 bg-surface-800' },
                    h('div', null,
                        h('h3', { className: 'text-lg font-bold text-white' },
                            modalType === 'pm' ? 'รายละเอียด PM (PM Details)' : 'รายละเอียด Inspection (Inspection Details)'
                        ),
                        h('p', { className: 'text-sm text-primary-400 mt-1 font-mono font-semibold' },
                            `DOC NO: ${selectedRecordModal.doc_no || '-'}`
                        )
                    ),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setSelectedRecordModal(null) },
                        h('i', { className: 'fa-solid fa-times' })
                    )
                ),

                // Modal Content
                h('div', { className: 'flex-1 overflow-y-auto p-6 space-y-6' },
                    h('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4' },
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Mold Code'),
                            h('p', { className: 'text-sm font-bold text-primary-400' }, selectedRecordModal.mold_code)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5 md:col-span-2' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Mold Name / ชื่อแม่พิมพ์'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedMold?.mold_name || '-')
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'DWG / Part'),
                            h('p', { className: 'text-xs font-bold text-white' }, selectedMold?.dwg_part1 || '-')
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Date'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecordModal.performed_date)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Performed By'),
                            h('p', { className: 'text-sm font-bold text-white' }, selectedRecordModal.performed_by)
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Level/Type'),
                            h('span', { className: 'badge badge-primary text-[10px]' },
                                `${modalType === 'pm' ? 'Level' : 'Type'} ${selectedRecordModal.pm_level || 1}`
                            )
                        ),
                        h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                            h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-1' }, 'Category'),
                            h('p', { className: 'text-xs font-bold text-white truncate' }, selectedRecordModal.category_name || '-')
                        )
                    ),

                    // Checklist Table
                    h('div', { className: 'space-y-3' },
                        h('h4', { className: 'text-sm font-bold text-surface-300' }, 'Inspection Checklist Items'),
                        h('div', { className: 'overflow-hidden rounded-xl border border-white/5' },
                            h('table', { className: 'w-full text-sm' },
                                h('thead', { className: 'bg-white/5 text-[10px] uppercase text-surface-500' },
                                    h('tr', null,
                                        h('th', { className: 'p-3 text-left' }, 'No.'),
                                        h('th', { className: 'p-3 text-left' }, 'Category'),
                                        h('th', { className: 'p-3 text-left' }, 'Item'),
                                        h('th', { className: 'p-3 text-center' }, 'Result')
                                    )
                                ),
                                h('tbody', { className: 'divide-y divide-white/5' },
                                    (selectedRecordModal.checklist_data || []).map((item, idx) =>
                                        h('tr', { key: idx, className: 'hover:bg-white/[0.02]' },
                                            h('td', { className: 'p-3 text-surface-500' }, idx + 1),
                                            h('td', { className: 'p-3 text-surface-400' }, item.category || '-'),
                                            h('td', { className: 'p-3 text-white' }, item.name),
                                            h('td', { className: 'p-3 text-center' },
                                                h('span', { className: `font-bold uppercase text-[10px] ${item.result === 'pass' ? 'text-emerald-400' : item.result === 'fail' ? 'text-red-400' : 'text-surface-500'}` },
                                                    item.result || 'N/A'
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    // Notes
                    h('div', { className: 'p-4 rounded-xl bg-white/5 border border-white/5' },
                        h('p', { className: 'text-[10px] text-surface-500 uppercase font-bold mb-2' }, 'Notes / หมายเหตุ'),
                        h('p', { className: 'text-sm text-surface-200 italic' }, selectedRecordModal.notes || 'ไม่มีหมายเหตุเพิ่มเติม')
                    )
                ),

                // Modal Footer — same as PM Summary page
                h('div', { className: 'p-6 border-t border-white/5 bg-surface-800 flex flex-wrap gap-3 justify-end' },
                    h('button', {
                        className: 'btn btn-primary',
                        onClick: () => downloadRecordPDF(selectedRecordModal, modalType === 'pm')
                    }, h('i', { className: 'fa-solid fa-file-pdf mr-2' }), 'Export PDF'),
                    h('button', {
                        className: 'btn bg-emerald-600 hover:bg-emerald-500 text-white',
                        onClick: () => downloadRecordExcel(selectedRecordModal, modalType === 'pm')
                    }, h('i', { className: 'fa-solid fa-file-excel mr-2' }), 'Download Excel'),
                    h('button', {
                        className: 'btn btn-ghost',
                        onClick: () => setSelectedRecordModal(null)
                    }, 'ปิดหน้าต่าง')
                )
            )
        )
    );
}

window.MoldHistoryPage = MoldHistoryPage;
