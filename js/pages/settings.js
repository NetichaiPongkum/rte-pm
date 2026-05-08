// ==========================================
// SETTINGS / USER MANAGEMENT PAGE
// ==========================================

function SettingsPage({ user, showToast }) {
    const h = React.createElement;
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [showModal, setShowModal] = React.useState(false);
    const [editingId, setEditingId] = React.useState(null);
    const [formData, setFormData] = React.useState({
        username: '',
        password: '',
        display_name: '',
        role: 'operator',
        vendor_access: 'ALL'
    });

    const isAdmin = user && user.role === 'admin';

    React.useEffect(() => {
        if (isAdmin) loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .order('username');
                if (error) throw error;
                setUsers(data || []);
            } else {
                const demoUsers = JSON.parse(localStorage.getItem('demo_users') || '[]');
                setUsers(demoUsers);
            }
        } catch (err) {
            showToast('โหลดข้อมูลผู้ใช้ล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async () => {
        if (!formData.username.trim() || !formData.password.trim()) {
            return showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'warning');
        }

        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient.from('users').upsert(formData);
                if (error) throw error;
            } else {
                const list = [...users];
                if (editingId) {
                    const idx = list.findIndex(u => u.id === editingId);
                    list[idx] = { ...formData, id: editingId };
                } else {
                    list.push({ ...formData, id: 'u-' + Date.now() });
                }
                setUsers(list);
                localStorage.setItem('demo_users', JSON.stringify(list));
            }
            showToast('บันทึกข้อมูลสำเร็จ', 'success');
            setShowModal(false);
            loadUsers();
        } catch (err) {
            showToast('บันทึกล้มเหลว', 'error');
        }
    };

    const deleteUser = async (id) => {
        if (!confirm('ยืนยันการลบผู้ใช้นี้?')) return;
        try {
            if (window.supabaseClient) {
                const { error } = await window.supabaseClient.from('users').delete().eq('id', id);
                if (error) throw error;
            } else {
                const list = users.filter(u => u.id !== id);
                setUsers(list);
                localStorage.setItem('demo_users', JSON.stringify(list));
            }
            showToast('ลบสำเร็จ', 'success');
            loadUsers();
        } catch (err) {
            showToast('ลบล้มเหลว', 'error');
        }
    };

    const openModal = (u = null) => {
        if (u) {
            setFormData({ ...u });
            setEditingId(u.id);
        } else {
            setFormData({ username: '', password: '', display_name: '', role: 'operator', vendor_access: 'ALL' });
            setEditingId(null);
        }
        setShowModal(true);
    };

    if (!isAdmin) {
        return h('div', { className: 'card p-10 text-center text-surface-400' }, 
            h('i', { className: 'fa-solid fa-lock text-4xl mb-4 text-primary-500/30' }),
            h('p', null, 'หน้านี้สำหรับแอดมินเท่านั้น')
        );
    }

    return h('div', { className: 'space-y-6 animate-fade-in' },
        h('div', { className: 'flex items-center justify-between' },
            h('div', null,
                h('h2', { className: 'text-lg font-semibold text-white' }, 'การตั้งค่าและจัดการผู้ใช้'),
                h('p', { className: 'text-sm text-surface-400' }, 'กำหนดสิทธิ์การเข้าถึงข้อมูลราย Vendor')
            ),
            h('button', { className: 'btn btn-primary', onClick: () => openModal() },
                h('i', { className: 'fa-solid fa-user-plus mr-2' }), 'เพิ่มผู้ใช้'
            )
        ),

        // Users Table
        h('div', { className: 'card p-0 overflow-hidden' },
            h('div', { className: 'overflow-x-auto' },
                h('table', { className: 'data-table' },
                    h('thead', null,
                        h('tr', null,
                            h('th', null, 'Username'),
                            h('th', null, 'Display Name'),
                            h('th', null, 'Role'),
                            h('th', null, 'Vendor Access'),
                            h('th', { className: 'text-right' }, 'จัดการ')
                        )
                    ),
                    h('tbody', null,
                        loading ? h('tr', null, h('td', { colSpan: 5, className: 'text-center py-10' }, h('div', { className: 'loading-spinner mx-auto' })))
                        : users.length === 0 ? h('tr', null, h('td', { colSpan: 5, className: 'text-center py-10 text-surface-500' }, 'ไม่พบรายชื่อผู้ใช้'))
                        : users.map((u, i) => 
                            h('tr', { key: u.id, className: 'animate-slide-up', style: { animationDelay: (i * 20) + 'ms' } },
                                h('td', { className: 'font-bold text-white' }, u.username),
                                h('td', null, u.display_name || '-'),
                                h('td', null, h('span', { className: `badge ${u.role === 'admin' ? 'badge-primary' : 'badge-info'}` }, u.role)),
                                h('td', null, 
                                    h('span', { className: `text-xs px-2 py-0.5 rounded-full ${u.vendor_access === 'ALL' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}` }, 
                                        u.vendor_access || 'ALL'
                                    )
                                ),
                                h('td', { className: 'text-right' },
                                    h('div', { className: 'flex justify-end gap-2' },
                                        h('button', { className: 'btn btn-ghost btn-sm text-primary-400', onClick: () => openModal(u) }, h('i', { className: 'fa-solid fa-edit' })),
                                        h('button', { className: 'btn btn-ghost btn-sm text-red-400', onClick: () => deleteUser(u.id) }, h('i', { className: 'fa-solid fa-trash-can' }))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),

        // Modal Add/Edit
        showModal && h('div', { className: 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md' },
            h('div', { className: 'card w-full max-w-md animate-scale-in' },
                h('div', { className: 'flex items-center justify-between mb-6' },
                    h('h3', { className: 'text-lg font-bold text-white' }, editingId ? 'แก้ไขสิทธิ์ผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'),
                    h('button', { className: 'btn btn-ghost btn-sm', onClick: () => setShowModal(false) }, h('i', { className: 'fa-solid fa-times' }))
                ),
                h('div', { className: 'space-y-4' },
                    h('div', null,
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'ชื่อผู้ใช้ (Username) *'),
                        h('input', { className: 'input', value: formData.username, onChange: e => setFormData({...formData, username: e.target.value}), disabled: !!editingId })
                    ),
                    h('div', null,
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'รหัสผ่าน *'),
                        h('input', { type: 'password', className: 'input', value: formData.password, onChange: e => setFormData({...formData, password: e.target.value}) })
                    ),
                    h('div', null,
                        h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'ชื่อที่แสดง'),
                        h('input', { className: 'input', value: formData.display_name, onChange: e => setFormData({...formData, display_name: e.target.value}) })
                    ),
                    h('div', { className: 'grid grid-cols-2 gap-4' },
                        h('div', null,
                            h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'ระดับสิทธิ์ (Role)'),
                            h('select', { className: 'input', value: formData.role, onChange: e => setFormData({...formData, role: e.target.value}) },
                                h('option', { value: 'admin' }, 'Admin'),
                                h('option', { value: 'engineer' }, 'Engineer'),
                                h('option', { value: 'operator' }, 'Operator')
                            )
                        ),
                        h('div', null,
                            h('label', { className: 'block text-xs font-medium text-surface-400 mb-1.5' }, 'สิทธิ์เข้าถึง Vendor'),
                            h('input', { 
                                className: 'input', 
                                placeholder: 'เช่น SPP หรือ ALL', 
                                value: formData.vendor_access, 
                                onChange: e => setFormData({...formData, vendor_access: e.target.value}) 
                            })
                        )
                    )
                ),
                h('div', { className: 'flex justify-end gap-3 mt-8' },
                    h('button', { className: 'btn btn-secondary', onClick: () => setShowModal(false) }, 'ยกเลิก'),
                    h('button', { className: 'btn btn-primary', onClick: handleSaveUser }, 'บันทึกสิทธิ์')
                )
            )
        )
    );
}

window.SettingsPage = SettingsPage;
