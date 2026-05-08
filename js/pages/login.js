// ==========================================
// LOGIN PAGE COMPONENT
// ==========================================

function LoginPage({ onLogin, showToast }) {
    const [username, setUsername] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            return;
        }

        setIsLoading(true);
        try {
            // Try Supabase login
            if (window.supabaseClient) {
                const { data, error: sbErr } = await window.supabaseClient
                    .from('users')
                    .select('*')
                    .eq('username', username.trim())
                    .eq('password', password.trim())
                    .maybeSingle();

                if (sbErr) throw sbErr;
                if (data) {
                    // Update last_login
                    await window.supabaseClient.from('users')
                        .update({ last_login: new Date().toISOString() })
                        .eq('id', data.id);

                    const userData = {
                        id: data.id,
                        username: data.username,
                        role: data.role || 'user',
                        display_name: data.display_name || data.username,
                        vendor_access: data.vendor_access || 'ALL',
                        permissions: data.permissions || {}
                    };
                    localStorage.setItem('pm_user', JSON.stringify(userData));
                    onLogin(userData);
                    if (showToast) showToast('เข้าสู่ระบบสำเร็จ', 'success');
                    return;
                }
            }

            // Demo mode fallback
            if (username === 'admin' && password === 'admin') {
                const demoUser = {
                    id: 'demo-admin',
                    username: 'admin',
                    role: 'admin',
                    display_name: 'Admin (Demo)',
                    vendor_access: 'ALL',
                    permissions: {}
                };
                localStorage.setItem('pm_user', JSON.stringify(demoUser));
                onLogin(demoUser);
                if (showToast) showToast('เข้าสู่ระบบ Demo Mode', 'info');
                return;
            }

            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        } catch (err) {
            console.error('Login error:', err);
            setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
        } finally {
            setIsLoading(false);
        }
    };

    const h = React.createElement;

    return h('div', { className: 'min-h-screen flex items-center justify-center relative overflow-hidden bg-surface-900' },
        // Background effects
        h('div', { className: 'absolute inset-0 pointer-events-none' },
            h('div', { className: 'absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/20 rounded-full blur-[120px]' }),
            h('div', { className: 'absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-[100px]' }),
            h('div', { className: 'absolute top-1/2 left-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2' })
        ),

        // Login Card
        h('div', { className: 'relative z-10 w-full max-w-md mx-4 animate-scale-in' },
            h('form', { onSubmit: handleSubmit, className: 'card-glass p-8 rounded-2xl' },
                // Logo
                h('div', { className: 'text-center mb-8' },
                    h('div', { className: 'w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-primary-500/30 mb-4' }, 'PM'),
                    h('h1', { className: 'text-xl font-bold text-white' }, 'PM Mold RTE'),
                    h('p', { className: 'text-surface-400 text-sm mt-1' }, 'Preventive Maintenance System')
                ),

                // Error Message
                error && h('div', { className: 'mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2' },
                    h('i', { className: 'fa-solid fa-circle-exclamation' }),
                    error
                ),

                // Username
                h('div', { className: 'mb-4' },
                    h('label', { className: 'block text-sm font-medium text-surface-300 mb-1.5' }, 'ชื่อผู้ใช้'),
                    h('div', { className: 'relative' },
                        h('i', { className: 'fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm' }),
                        h('input', {
                            type: 'text',
                            className: 'input pl-10',
                            placeholder: 'กรอกชื่อผู้ใช้',
                            value: username,
                            onChange: (e) => { setUsername(e.target.value); setError(''); },
                            autoFocus: true,
                            id: 'login-username'
                        })
                    )
                ),

                // Password
                h('div', { className: 'mb-6' },
                    h('label', { className: 'block text-sm font-medium text-surface-300 mb-1.5' }, 'รหัสผ่าน'),
                    h('div', { className: 'relative' },
                        h('i', { className: 'fa-solid fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm' }),
                        h('input', {
                            type: showPassword ? 'text' : 'password',
                            className: 'input pl-10 pr-10',
                            placeholder: 'กรอกรหัสผ่าน',
                            value: password,
                            onChange: (e) => { setPassword(e.target.value); setError(''); },
                            id: 'login-password'
                        }),
                        h('button', {
                            type: 'button',
                            className: 'absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors',
                            onClick: () => setShowPassword(!showPassword)
                        }, h('i', { className: `fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm` }))
                    )
                ),

                // Submit Button
                h('button', {
                    type: 'submit',
                    className: 'btn btn-primary w-full py-2.5',
                    disabled: isLoading,
                    id: 'login-submit'
                },
                    isLoading
                        ? h('span', { className: 'flex items-center gap-2' },
                            h('div', { className: 'loading-spinner-sm loading-spinner' }),
                            'กำลังเข้าสู่ระบบ...'
                          )
                        : h('span', { className: 'flex items-center gap-2' },
                            h('i', { className: 'fa-solid fa-right-to-bracket' }),
                            'เข้าสู่ระบบ'
                          )
                ),

                // Demo hint
                h('div', { className: 'mt-6 pt-4 border-t border-white/5 text-center' },
                    h('p', { className: 'text-xs text-surface-500' },
                        'Demo: ใช้ ',
                        h('span', { className: 'text-primary-400 font-mono' }, 'admin'),
                        ' / ',
                        h('span', { className: 'text-primary-400 font-mono' }, 'admin')
                    )
                )
            )
        )
    );
}

// Expose globally
window.LoginPage = LoginPage;
