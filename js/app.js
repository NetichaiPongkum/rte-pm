// ==========================================
// PM MOLD RTE - Main Application Entry
// ==========================================

const { useState, useEffect, useCallback } = React;

// ==========================================
// APP COMPONENT
// ==========================================
function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [appData, setAppData] = useState({
        selectedMold: null
    });

    const h = React.createElement;

    // Toast notification helper
    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // Initialize app - check saved session
    useEffect(() => {
        const init = async () => {
            try {
                const saved = localStorage.getItem('pm_user');
                if (saved) {
                    setUser(JSON.parse(saved));
                }
                await new Promise(r => setTimeout(r, 600));
            } catch (err) {
                console.error('[App] Init error:', err);
                localStorage.removeItem('pm_user');
            } finally {
                setIsLoading(false);
                const ls = document.getElementById('loading-screen');
                if (ls) {
                    ls.style.opacity = '0';
                    ls.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => ls.remove(), 300);
                }
            }
        };
        init();
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        setCurrentPage('home');
    };

    const handleLogout = () => {
        localStorage.removeItem('pm_user');
        setUser(null);
        setCurrentPage('home');
        showToast('ออกจากระบบแล้ว', 'info');
    };

    // Navigation items filtered by role
    const allNavItems = [
        { id: 'home',       icon: 'fa-house',       label: 'หน้าหลัก' },
        { id: 'parts',      icon: 'fa-database',    label: 'Part Master' },
        { id: 'pm',         icon: 'fa-clipboard-check', label: 'PM Checklist' },
        { id: 'pm-history', icon: 'fa-rectangle-list',   label: 'รายการ PM' },
        { id: 'settings',   icon: 'fa-user-gear',   label: 'จัดการผู้ใช้', adminOnly: true },
        { id: 'dashboard',  icon: 'fa-chart-line',   label: 'แดชบอร์ด' },
        { id: 'issues',     icon: 'fa-triangle-exclamation', label: 'แจ้งปัญหา' },
        { id: 'reports',    icon: 'fa-file-lines',   label: 'รายงาน' },
    ];

    const navItems = allNavItems.filter(item => !item.adminOnly || (user && user.role === 'admin'));

    // Render page content
    const renderPage = () => {
        try {
            switch (currentPage) {
                case 'home':       return h(HomePage, { user, showToast, setCurrentPage });
                case 'parts':      return window.PartsPage ? h(window.PartsPage, { user, showToast, setCurrentPage, setAppData }) : h(ComponentLoading, { name: 'PartsPage' });
                case 'pm':         return window.ChecklistPage ? h(window.ChecklistPage, { user, showToast, setCurrentPage, selectedMold: appData.selectedMold, clearSelectedMold: () => setAppData(p => ({ ...p, selectedMold: null })) }) : h(ComponentLoading, { name: 'ChecklistPage' });
                case 'pm-history': return window.PMHistoryPage ? h(window.PMHistoryPage, { user, showToast }) : h(ComponentLoading, { name: 'PMHistoryPage' });
                case 'settings':   return window.SettingsPage ? h(window.SettingsPage, { user, showToast }) : h(ComponentLoading, { name: 'SettingsPage' });
                case 'dashboard':  return h(PlaceholderPage, { title: 'แดชบอร์ด', icon: 'fa-chart-line' });
                case 'issues':     return h(PlaceholderPage, { title: 'แจ้งปัญหา', icon: 'fa-triangle-exclamation' });
                case 'reports':    return h(PlaceholderPage, { title: 'รายงาน', icon: 'fa-file-lines' });
                default:           return h(HomePage, { user, showToast, setCurrentPage });
            }
        } catch (err) {
            console.error('[App] Render error:', err);
            return h('div', { className: 'card border-red-500/50 bg-red-500/5 p-6 text-center' },
                h('i', { className: 'fa-solid fa-circle-exclamation text-red-400 text-3xl mb-4' }),
                h('h3', { className: 'text-lg font-bold text-white mb-2' }, 'เกิดข้อผิดพลาดในการแสดงผล'),
                h('p', { className: 'text-surface-400 text-sm mb-4' }, err.message),
                h('button', { className: 'btn btn-primary btn-sm', onClick: () => window.location.reload() }, 'รีโหลดหน้าเว็บ')
            );
        }
    };

    function ComponentLoading({ name }) {
        return h('div', { className: 'flex flex-col items-center justify-center py-20' },
            h('div', { className: 'loading-spinner mb-4' }),
            h('p', { className: 'text-surface-400 text-sm animate-pulse' }, `กำลังโหลดส่วนประกอบ ${name}...`)
        );
    }

    if (isLoading) return null;

    // Show Login if not authenticated
    if (!user) {
        return h('div', null,
            h(window.LoginPage, { onLogin: handleLogin, showToast }),
            toasts.length > 0 && h(ToastContainer, { toasts })
        );
    }

    const isAdmin = user.role === 'admin';
    const initials = (user.display_name || user.username || 'U').substring(0, 2).toUpperCase();

    return h('div', { className: 'flex min-h-screen' },
        // Sidebar
        h('aside', {
            className: 'sidebar',
            style: { width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }
        },
            // Logo
            h('div', { className: 'p-5 border-b border-white/5' },
                h('div', { className: 'flex items-center gap-3' },
                    h('div', {
                        className: 'w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0'
                    }, 'PM'),
                    sidebarOpen && h('div', null,
                        h('h1', { className: 'text-sm font-bold text-white' }, 'PM Mold RTE'),
                        h('p', { className: 'text-xs text-surface-400' }, 'Management System')
                    )
                )
            ),

            // Nav Items
            h('nav', { className: 'flex-1 p-3 space-y-1 overflow-y-auto' },
                navItems.map(item =>
                    h('div', {
                        key: item.id,
                        className: `sidebar-item ${currentPage === item.id ? 'active' : ''}`,
                        onClick: () => setCurrentPage(item.id),
                    },
                        h('i', { className: `fa-solid ${item.icon} w-5 text-center` }),
                        sidebarOpen && h('span', null, item.label)
                    )
                )
            ),

            // User info + Logout
            h('div', { className: 'p-3 border-t border-white/5 space-y-1' },
                h('div', { className: 'sidebar-item', onClick: () => setSidebarOpen(!sidebarOpen) },
                    h('i', { className: `fa-solid ${sidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'} w-5 text-center` }),
                    sidebarOpen && h('span', null, 'ย่อเมนู')
                ),
                sidebarOpen && h('div', { className: 'p-3 rounded-xl bg-white/[0.03] mt-2' },
                    h('div', { className: 'flex items-center gap-3' },
                        h('div', { className: 'w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0' }, initials),
                        h('div', { className: 'min-w-0' },
                            h('p', { className: 'text-sm font-medium text-white truncate' }, user.display_name || user.username),
                            h('p', { className: 'text-xs text-surface-500' }, isAdmin ? '🔑 Admin' : '👤 ' + user.role)
                        )
                    )
                ),
                h('div', { className: 'sidebar-item text-red-400 hover:text-red-300', onClick: handleLogout },
                    h('i', { className: 'fa-solid fa-right-from-bracket w-5 text-center' }),
                    sidebarOpen && h('span', null, 'ออกจากระบบ')
                )
            )
        ),

        // Main Content
        h('main', {
            className: 'flex-1 transition-all duration-300',
            style: { marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }
        },
            // Header
            h('header', { className: 'glass sticky top-0 z-40 px-6 py-4 flex items-center justify-between' },
                h('h2', { className: 'text-lg font-semibold text-white' },
                    navItems.find(n => n.id === currentPage)?.label || 'หน้าหลัก'
                ),
                h('div', { className: 'flex items-center gap-3' },
                    h('button', { className: 'btn btn-ghost btn-sm' },
                        h('i', { className: 'fa-solid fa-bell' })
                    ),
                    h('div', { className: 'w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-xs font-bold text-white' }, initials)
                )
            ),
            h('div', { className: 'p-6 page-enter' }, renderPage())
        ),

        // Toasts
        toasts.length > 0 && h(ToastContainer, { toasts })
    );
}

// ==========================================
// TOAST CONTAINER
// ==========================================
function ToastContainer({ toasts }) {
    const h = React.createElement;
    return h('div', { className: 'toast-container' },
        toasts.map(t =>
            h('div', { key: t.id, className: `toast toast-${t.type} animate-slide-up` },
                h('i', { className: `fa-solid ${
                    t.type === 'success' ? 'fa-check-circle' :
                    t.type === 'error'   ? 'fa-times-circle' :
                    t.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
                }` }),
                h('span', { className: 'text-sm' }, t.message)
            )
        )
    );
}

// ==========================================
// HOME PAGE
// ==========================================
function HomePage({ user, showToast, setCurrentPage }) {
    const h = React.createElement;
    const stats = [
        { label: 'แม่พิมพ์ทั้งหมด', value: '—', icon: 'fa-cubes',    color: 'from-blue-500 to-blue-700' },
        { label: 'PM รอดำเนินการ',  value: '—', icon: 'fa-clock',    color: 'from-amber-500 to-orange-600' },
        { label: 'ปัญหาที่เปิดอยู่',  value: '—', icon: 'fa-bug',      color: 'from-red-500 to-rose-600' },
        { label: 'เสร็จสิ้นเดือนนี้',  value: '—', icon: 'fa-check',    color: 'from-emerald-500 to-green-600' },
    ];

    return h('div', { className: 'space-y-6 animate-fade-in' },
        // Welcome Banner
        h('div', { className: 'card-glass p-8 relative overflow-hidden' },
            h('div', { className: 'absolute -top-20 -right-20 w-60 h-60 bg-primary-500/10 rounded-full blur-3xl' }),
            h('div', { className: 'absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl' }),
            h('div', { className: 'relative z-10' },
                h('h1', { className: 'text-2xl font-bold text-white mb-2' },
                    'สวัสดี, ',
                    h('span', { className: 'text-gradient' }, user?.display_name || user?.username || 'User')
                ),
                h('p', { className: 'text-surface-300 max-w-xl' },
                    'ระบบ Preventive Maintenance สำหรับการติดตาม วางแผน และรายงานสถานะการบำร蝓รักษาแม่พิมพ์'
                )
            )
        ),

        // Stats Grid
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' },
            stats.map((stat, i) =>
                h('div', { key: i, className: `card hover:scale-[1.02] stagger-${i + 1} animate-slide-up` },
                    h('div', { className: 'flex items-center justify-between mb-3' },
                        h('span', { className: 'text-xs text-surface-400 font-medium' }, stat.label),
                        h('div', { className: `w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center` },
                            h('i', { className: `fa-solid ${stat.icon} text-white text-sm` })
                        )
                    ),
                    h('p', { className: 'text-2xl font-bold text-white' }, stat.value),
                    h('p', { className: 'text-xs text-surface-500 mt-1' }, 'เชื่อมต่อ Supabase เพื่อดูข้อมูล')
                )
            )
        ),

        // Quick Actions
        h('div', { className: 'card' },
            h('h3', { className: 'text-sm font-semibold text-surface-300 mb-4' },
                h('i', { className: 'fa-solid fa-bolt mr-2 text-amber-400' }),
                'เมนูลัด'
            ),
            h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' },
                [
                    { icon: 'fa-cubes',           title: 'ฐานข้อมูลแม่พิมพ์', desc: 'ค้นหาและเลือกแม่พิมพ์',       page: 'parts' },
                    { icon: 'fa-clipboard-check', title: 'เริ่มตรวจ PM',   desc: 'เลือกเทมเพลตและเริ่มตรวจเช็ค', page: 'pm' },
                    { icon: 'fa-rectangle-list',   title: 'รายการ PM',      desc: 'ดูประวัติการตรวจสอบทั้งหมด',     page: 'pm-history' },
                ].map((action, i) =>
                    h('div', {
                        key: i,
                        className: 'p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-primary-500/30 transition-all cursor-pointer group',
                        onClick: () => setCurrentPage(action.page)
                    },
                        h('div', { className: 'w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center mb-3 group-hover:bg-primary-500/20 transition-colors' },
                            h('i', { className: `fa-solid ${action.icon} text-primary-400` })
                        ),
                        h('h4', { className: 'text-sm font-medium text-white mb-1' }, action.title),
                        h('p', { className: 'text-xs text-surface-500' }, action.desc)
                    )
                )
            )
        )
    );
}

// ==========================================
// PLACEHOLDER PAGE
// ==========================================
function PlaceholderPage({ title, icon }) {
    const h = React.createElement;
    return h('div', { className: 'flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in' },
        h('div', { className: 'w-20 h-20 rounded-2xl bg-surface-800 border border-white/5 flex items-center justify-center mb-6 animate-float' },
            h('i', { className: `fa-solid ${icon} text-3xl text-surface-500` })
        ),
        h('h2', { className: 'text-xl font-semibold text-surface-300 mb-2' }, title),
        h('p', { className: 'text-surface-500 text-sm max-w-md' },
            'หน้านี้พร้อมสำหรับการพัฒนา'
        ),
        h('div', { className: 'mt-6' },
            h('span', { className: 'badge badge-primary' },
                h('i', { className: 'fa-solid fa-code mr-1' }), 'Ready to develop'
            )
        )
    );
}

// ==========================================
// MOUNT APP
// ==========================================
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
