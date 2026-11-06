import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Activity, ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronRight, Clock3, HeartPulse, LayoutDashboard, LogOut, Menu, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://mediqueue-backend-szxv.onrender.com/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://mediqueue-backend-szxv.onrender.com';
const API = axios.create({ baseURL: API_URL });
const today = () => new Date().toISOString().slice(0, 10);
function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('mediqueue-user') || 'null');
    if (!saved) return null;
    if (saved.user && saved.token) return { ...saved.user, token: saved.token };
    if (saved.token && saved.name && saved.role) return saved;
    localStorage.removeItem('mediqueue-user');
    return null;
  } catch {
    localStorage.removeItem('mediqueue-user');
    return null;
  }
}

function App() {
  const [user, setUser] = useState(readSession);
  const [view, setView] = useState('dashboard');
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notify = (message) => setToast(message);
  useEffect(() => {
    API.get('/doctors').then(({ data }) => setDoctors(data)).catch((error) => notify(error.response?.data?.message || 'Unable to load doctors.'));
    API.get('/departments').then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user?.token) return;
    API.get('/appointments/my', { headers: { Authorization: `Bearer ${user.token}` } }).then(({ data }) => setAppointments(data)).catch((error) => notify(error.response?.data?.message || 'Unable to load appointments.'));
  }, [user]);
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('queue:updated', () => notify('Queue updated in real time.'));
    return () => socket.disconnect();
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredDoctors = useMemo(() => doctors.filter((doctor) => {
    const matchesText = `${doctor.name} ${doctor.specialization}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (!department || doctor.departmentId === department);
  }), [doctors, query, department]);
  if (!user) return <Landing onAuthenticated={(nextUser) => { const signedInUser = nextUser.user ? { ...nextUser.user, token: nextUser.token } : nextUser; setUser(signedInUser); localStorage.setItem('mediqueue-user', JSON.stringify(signedInUser)); }} />;
  if (user.role !== 'patient') return <StaffApp user={user} onLogout={() => { localStorage.removeItem('mediqueue-user'); setUser(null); }} onInfo={notify} />;

  const authHeaders = { Authorization: `Bearer ${user.token}` };
  const logout = async () => {
    try { await API.post('/auth/logout', {}, { headers: authHeaders }); } catch { /* local sign-out remains available */ }
    localStorage.removeItem('mediqueue-user');
    setUser(null);
  };
  const book = async (data) => {
    try {
      const { data: appointment } = await API.post('/appointments', data, { headers: authHeaders });
      setAppointments((items) => [...items, appointment]);
      setBookingDoctor(null);
      setView('appointments');
      notify('Appointment booked successfully.');
    } catch (error) { notify(error.response?.data?.message || 'Booking could not be completed.'); }
  };
  const cancel = async (id) => {
    try {
      const { data } = await API.patch(`/appointments/${id}/cancel`, {}, { headers: authHeaders });
      setAppointments((items) => items.map((item) => item.id === id ? data : item));
      notify('Appointment cancelled.');
    } catch (error) { notify(error.response?.data?.message || 'Unable to cancel appointment.'); }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={20} /></div><span>Medi<span>Queue</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>
        <NavItem icon={<LayoutDashboard size={18} />} label="Overview" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setSidebar(false); }} />
        <NavItem icon={<CalendarDays size={18} />} label="My appointments" active={view === 'appointments'} onClick={() => { setView('appointments'); setSidebar(false); }} badge={appointments.length} />
        <NavItem icon={<Stethoscope size={18} />} label="Find a doctor" active={view === 'doctors'} onClick={() => { setView('doctors'); setSidebar(false); }} />
        <NavItem icon={<Activity size={18} />} label="Live queue" active={view === 'queue'} onClick={() => { setView('queue'); setSidebar(false); }} />
      </nav>
      <div className="sidebar-bottom">
        <NavItem icon={<ShieldCheck size={18} />} label="Profile & settings" active={view === 'settings'} onClick={() => { setView('settings'); setSidebar(false); }} />
        <button className="nav-item logout" onClick={logout}><LogOut size={18} /> Sign out</button>
      </div>
    </aside>
    {sidebar && <button className="sidebar-overlay" onClick={() => setSidebar(false)} aria-label="Close menu" />}
    <main className="main-content">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setSidebar(true)} aria-label="Open menu"><Menu /></button>
        <div><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h1>{view === 'dashboard' ? `Good morning, ${user.name.split(' ')[0]}!` : view === 'doctors' ? 'Find your specialist' : view === 'appointments' ? 'My appointments' : view === 'queue' ? 'Live queue tracking' : 'Profile & settings'}</h1></div>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Show notifications"><Bell size={19} /><i /></button>
          {notificationsOpen && <div className="notification-popover"><strong>Notifications</strong><p>Your appointment updates will appear here.</p><button className="text-btn" onClick={() => setNotificationsOpen(false)}>Close</button></div>}
          <div className="user-chip"><div className="avatar small">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{user.name}</strong><span>{user.role}</span></div></div>
        </div>
      </header>
      {view === 'dashboard' && <Dashboard appointments={appointments} onBook={() => setView('doctors')} onQueue={() => setView('queue')} onInfo={notify} />}
      {view === 'doctors' && <Doctors doctors={filteredDoctors} departments={departments} query={query} setQuery={setQuery} department={department} setDepartment={setDepartment} onBook={setBookingDoctor} />}
      {view === 'appointments' && <Appointments appointments={appointments} onCancel={cancel} onInfo={notify} />}
      {view === 'queue' && <Queue appointment={appointments.find((item) => ['Waiting', 'Called', 'In Consultation'].includes(item.status))} onInfo={notify} />}
      {view === 'settings' && <Settings user={user} onInfo={notify} />}
    </main>
    {bookingDoctor && <Booking doctor={bookingDoctor} onClose={() => setBookingDoctor(null)} onBook={book} />}
    {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
  </div>;
}

function NavItem({ icon, label, active, onClick, badge }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <b>{badge}</b>}</button>; }
function StaffApp({ user, onLogout, onInfo }) {
  const [data, setData] = useState({ stats: {}, appointments: [] });
  const [departments, setDepartments] = useState([]);
  const [doctorForm, setDoctorForm] = useState({ name: '', email: '', password: '', specialization: '', departmentId: '', qualification: '', experience: '', fee: 50 });
  const [loading, setLoading] = useState(true);
  const headers = { Authorization: `Bearer ${user.token}` };
  const load = () => {
    const endpoint = user.role === 'admin' ? '/dashboard/admin' : '/dashboard/doctor';
    API.get(endpoint, { headers }).then(({ data: result }) => setData(result)).catch((error) => onInfo(error.response?.data?.message || 'Unable to load dashboard.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); if (user.role === 'admin') API.get('/departments').then(({ data: result }) => setDepartments(result)).catch(() => {}); }, []);
  const callNext = async () => {
    try { await API.post('/queue/call-next', {}, { headers }); onInfo('Next patient called.'); load(); } catch (error) { onInfo(error.response?.data?.message || 'Unable to call next patient.'); }
  };
  const updateStatus = async (id, status) => {
    try { await API.patch(`/queue/${id}/status`, { status }, { headers }); onInfo(`Appointment marked ${status}.`); load(); } catch (error) { onInfo(error.response?.data?.message || 'Unable to update appointment.'); }
  };
  const createDoctor = async (event) => {
    event.preventDefault();
    try { await API.post('/doctors', { ...doctorForm, fee: Number(doctorForm.fee) }, { headers }); setDoctorForm({ name: '', email: '', password: '', specialization: '', departmentId: '', qualification: '', experience: '', fee: 50 }); onInfo('Doctor account created.'); } catch (error) { onInfo(error.response?.data?.message || 'Unable to create doctor account.'); }
  };
  const stats = data.stats || {};
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Activity size={20} /></div><span>Medi<span>Queue</span></span></div><div className="workspace-label">STAFF WORKSPACE</div><nav><button className="nav-item active"><LayoutDashboard size={18} /><span>Overview</span></button><button className="nav-item" onClick={callNext}><Activity size={18} /><span>Call next patient</span></button></nav><div className="sidebar-bottom"><button className="nav-item logout" onClick={onLogout}><LogOut size={18} /> Sign out</button></div></aside><main className="main-content"><header className="topbar"><div><p className="eyebrow">{user.role.toUpperCase()} DASHBOARD</p><h1>Welcome, {user.name.split(' ')[1] || user.name}</h1></div><div className="user-chip"><div className="avatar small">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{user.name}</strong><span>{user.role}</span></div></div></header><div className="page"><section className="stats-grid"><Stat icon={<Users />} label="Total patients" value={stats.total ?? stats.patients ?? 0} detail="All records" /><Stat icon={<Clock3 />} label="Waiting patients" value={stats.waiting ?? 0} detail="Live queue" /><Stat icon={<CheckCircle2 />} label="Completed" value={stats.completed ?? 0} detail="Consultations" /><Stat icon={<CalendarDays />} label="Appointments" value={stats.appointments ?? data.appointments.length} detail="Total bookings" /></section>{user.role === 'admin' && <form className="panel admin-form" onSubmit={createDoctor}><div className="panel-title"><div><span className="eyebrow">USER MANAGEMENT</span><h3>Add doctor account</h3></div></div><div className="admin-form-grid"><input required placeholder="Doctor name" value={doctorForm.name} onChange={(event) => setDoctorForm({ ...doctorForm, name: event.target.value })} /><input required type="email" placeholder="Login email" value={doctorForm.email} onChange={(event) => setDoctorForm({ ...doctorForm, email: event.target.value })} /><input required minLength="8" placeholder="Temporary password" value={doctorForm.password} onChange={(event) => setDoctorForm({ ...doctorForm, password: event.target.value })} /><input required placeholder="Specialization" value={doctorForm.specialization} onChange={(event) => setDoctorForm({ ...doctorForm, specialization: event.target.value })} /><select required value={doctorForm.departmentId} onChange={(event) => setDoctorForm({ ...doctorForm, departmentId: event.target.value })}><option value="">Department</option>{departments.map((item) => <option value={item.id || item._id} key={item.id || item._id}>{item.name}</option>)}</select><input placeholder="Qualification" value={doctorForm.qualification} onChange={(event) => setDoctorForm({ ...doctorForm, qualification: event.target.value })} /></div><button className="primary-btn">Create doctor login <ArrowRight size={16} /></button></form>}<div className="panel"><div className="panel-title"><div><span className="eyebrow">QUEUE MANAGEMENT</span><h3>Today's appointments</h3></div><button className="primary-btn" onClick={callNext}>Call next patient <ArrowRight size={16} /></button></div>{loading ? <p className="muted">Loading appointments...</p> : data.appointments.length ? data.appointments.map((appointment) => <div className="appointment-detail" key={appointment.id}><div className="date-box"><strong>{appointment.token}</strong><span>TOKEN</span></div><div className="appointment-info"><strong>{appointment.doctor || 'Patient appointment'}</strong><span>{appointment.department} · {appointment.time}</span><small>{appointment.id} · {appointment.reason}</small></div><Status value={appointment.status} /><select className="status-select" value={appointment.status} onChange={(event) => updateStatus(appointment.id, event.target.value)}><option>Waiting</option><option>Called</option><option>In Consultation</option><option>Completed</option><option>No Show</option><option>Cancelled</option></select></div>) : <div className="empty-state"><CalendarDays size={35} /><h2>No appointments</h2><p>New appointments will appear here.</p></div>}</div></div></main></div>;
}
function Dashboard({ appointments, onBook, onQueue, onInfo }) {
  const current = appointments.find((item) => item.status === 'Waiting');
  return <div className="page">
    <section className="welcome-grid"><div className="hero-card"><div className="hero-copy"><span className="pill blue"><Activity size={14} /> Your care, simplified</span><h2>Healthcare that moves<br /><em>at your pace.</em></h2><p>Book appointments, skip the waiting room, and stay informed every step of the way.</p><button className="primary-btn" onClick={onBook}>Book an appointment <ArrowRight size={17} /></button></div><div className="hero-illustration"><div className="circle c1" /><div className="circle c2" /><HeartPulse size={86} /></div></div><div className="queue-card"><div className="card-heading"><span>Live queue</span><button onClick={onQueue} aria-label="Open live queue"><ChevronRight size={17} /></button></div>{current ? <><div className="queue-token">{current.token}</div><p className="muted">Current token <strong>A-021</strong></p><div className="progress"><span style={{ width: '68%' }} /></div><div className="queue-meta"><span><strong>3</strong> patients ahead</span><span><Clock3 size={14} /> ~25 min</span></div></> : <div className="empty-mini"><Activity size={24} /><span>No active queue</span><small>Book an appointment to see live updates.</small></div>}</div></section>
    <section className="stats-grid"><Stat icon={<CalendarDays />} label="Total appointments" value={appointments.length} detail="+2 this month" /><Stat icon={<Clock3 />} label="Upcoming" value={appointments.filter((item) => !['Completed', 'Cancelled'].includes(item.status)).length} detail="Next appointment" /><Stat icon={<CheckCircle2 />} label="Completed visits" value="12" detail="+4 this month" /><Stat icon={<Users />} label="Health records" value="08" detail="All up to date" /></section>
    <section className="section-grid"><div className="panel"><div className="panel-title"><div><span className="eyebrow">YOUR SCHEDULE</span><h3>Upcoming appointments</h3></div><button className="text-btn" onClick={() => onQueue()}>View all <ArrowRight size={15} /></button></div>{appointments.slice(0, 2).map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} />)}</div><div className="panel tips"><div className="panel-title"><div><span className="eyebrow">HEALTH TIPS</span><h3>For your wellbeing</h3></div></div><div className="tip-content"><div className="tip-icon"><HeartPulse /></div><div><h4>Keep your heart healthy</h4><p>Small daily habits can make a big difference to your cardiovascular health.</p><button className="text-btn" onClick={() => onInfo('Health article: walk regularly, eat balanced meals, and schedule routine checkups.')}>Read article <ArrowRight size={15} /></button></div></div></div></section>
  </div>;
}
function Stat({ icon, label, value, detail }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function AppointmentRow({ appointment }) { return <div className="appointment-row"><div className="doctor-avatar">{appointment.doctor.split(' ').slice(1).map((p) => p[0]).join('')}</div><div className="appointment-info"><strong>{appointment.doctor}</strong><span>{appointment.department} · {appointment.reason}</span></div><div className="appointment-time"><strong>{appointment.time}</strong><span>{appointment.date}</span></div><Status value={appointment.status} /></div>; }
function Status({ value }) { return <span className={`status ${value.toLowerCase().replaceAll(' ', '-')}`}><i />{value}</span>; }
function Doctors({ doctors, departments, query, setQuery, department, setDepartment, onBook }) { return <div className="page"><div className="directory-toolbar"><div className="search-field"><Search size={18} /><input aria-label="Search doctors" placeholder="Search by doctor or specialty" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select className="filter-btn" aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All specialties</option>{departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><div className="doctor-grid">{doctors.length ? doctors.map((doctor) => <div className="doctor-card" key={doctor.id}><div className="doctor-card-top"><div className="avatar doctor">{doctor.avatar}</div><span className="availability"><i />{doctor.availability}</span></div><h3>{doctor.name}</h3><p className="specialty">{doctor.specialization}</p><div className="doctor-details"><span><CheckCircle2 size={15} />{doctor.qualification}</span><span><Clock3 size={15} />{doctor.experience} experience</span></div><div className="doctor-card-bottom"><div><strong>${doctor.fee}</strong><span> / consultation</span></div><button className="outline-btn" onClick={() => onBook(doctor)}>Book now <ArrowRight size={15} /></button></div></div>) : <div className="empty-state"><Search size={32} /><h2>No doctors found</h2><p>Try a different name or department.</p></div>}</div></div>; }
function Appointments({ appointments, onCancel, onInfo }) { return <div className="page"><div className="tabs"><button className="active">All <b>{appointments.length}</b></button><button onClick={() => onInfo('Completed appointments are shown with their final status.')}>Completed</button><button onClick={() => onInfo('Cancelled appointments are shown with their final status.')}>Cancelled</button></div><div className="panel appointment-list">{appointments.length ? appointments.map((appointment) => <div className="appointment-detail" key={appointment.id}><div className="date-box"><strong>{appointment.date.slice(-2)}</strong><span>{appointment.date.slice(5, 7) === '12' ? 'DEC' : 'DATE'}</span></div><div className="appointment-info"><strong>{appointment.doctor}</strong><span>{appointment.department} · {appointment.time}</span><small>{appointment.id} · Token {appointment.token}</small></div><Status value={appointment.status} /><button className="icon-btn subtle" onClick={() => appointment.status === 'Cancelled' ? onInfo('This appointment is already cancelled.') : onCancel(appointment.id)} aria-label={`Manage appointment ${appointment.id}`}><ChevronRight size={18} /></button></div>) : <div className="empty-state"><CalendarDays size={35} /><h2>No appointments yet</h2><p>Find a doctor to book your first appointment.</p></div>}</div></div>; }
function Queue({ appointment, onInfo }) { return <div className="page queue-page">{appointment ? <><div className="queue-header"><div><span className="pill teal"><span className="live-dot" /> Live updates enabled</span><h2>Your place in line</h2><p>We will notify you when it is almost your turn.</p></div><div className="refresh-label"><Activity size={16} /> Updated just now</div></div><div className="queue-main-card"><div className="big-token"><span>Your token</span><strong>{appointment.token}</strong><Status value={appointment.status} /></div><div className="queue-stats"><div><span>Currently serving</span><strong>A-021</strong></div><div><span>Patients ahead</span><strong>03</strong></div><div><span>Estimated wait</span><strong>~25 min</strong></div></div><div className="large-progress"><div><span>Queue progress</span><strong>68%</strong></div><div className="progress"><span style={{ width: '68%' }} /></div></div></div><div className="queue-note"><Bell size={18} /><div><strong>You'll receive a notification</strong><p>We'll alert you when you're next. <button className="text-btn" onClick={() => onInfo('Notifications are enabled for this appointment.')}>Check settings</button></p></div></div></> : <div className="empty-state"><Activity size={40} /><h2>No active queue</h2><p>Your live queue will appear here after you book an appointment.</p></div>}</div>; }
function Settings({ user, onInfo }) { return <div className="page"><div className="panel settings-panel"><div className="avatar doctor">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><h2>{user.name}</h2><p>{user.email}</p><label>Full name<input value={user.name} readOnly /></label><label>Email address<input value={user.email} readOnly /></label><button className="primary-btn" onClick={() => onInfo('Your profile is up to date.')}>Save profile</button></div></div>; }
function Booking({ doctor, onClose, onBook }) { const [date, setDate] = useState(today()); const [time, setTime] = useState('10:30 AM'); const [reason, setReason] = useState(''); return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><span className="eyebrow">BOOK APPOINTMENT</span><h2>With {doctor.name}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close booking"><X /></button></div><div className="booking-doctor"><div className="avatar doctor">{doctor.avatar}</div><div><strong>{doctor.specialization}</strong><span>{doctor.department} · ${doctor.fee} consultation</span></div></div><label>Choose a date<input type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Choose a time<div className="slot-grid">{['09:00 AM', '10:30 AM', '12:00 PM', '02:00 PM', '03:30 PM'].map((slot) => <button type="button" className={time === slot ? 'selected' : ''} onClick={() => setTime(slot)} key={slot}>{slot}</button>)}</div></label><label>Reason for visit <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell the doctor briefly how we can help..." /></label><button className="primary-btn full" onClick={() => onBook({ doctorId: doctor.id, date, time, reason })}>Confirm appointment <ArrowRight size={17} /></button></div></div>; }
function Landing({ onAuthenticated }) { const [mode, setMode] = useState('login'); const [name, setName] = useState(''); const [email, setEmail] = useState('patient@mediqueue.demo'); const [password, setPassword] = useState('password123'); const [message, setMessage] = useState(''); const submit = async (event) => { event.preventDefault(); try { const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'; const { data } = await API.post(endpoint, { name, email, password }); onAuthenticated(data); } catch (error) { setMessage(error.response?.data?.message || 'The API is unavailable. Start the backend with npm run dev.'); } }; const forgot = async () => { try { const { data } = await API.post('/auth/forgot-password', { email }); setMessage(data.message); } catch (error) { setMessage(error.response?.data?.message || 'Unable to send reset instructions.'); } }; return <div className="landing"><nav className="landing-nav"><div className="brand"><div className="brand-mark"><Activity size={20} /></div><span>Medi<span>Queue</span></span></div><div className="landing-links"><a href="#how-it-works">How it works</a><a href="#doctors">Our doctors</a><a href="#hospitals">For hospitals</a></div><button className="login-btn" onClick={() => setMode('login')}>Sign in <ArrowRight size={16} /></button></nav><section className="landing-hero"><div className="landing-copy"><span className="pill blue">The smarter way to see a doctor</span><h1>Your health.<br /><em>Your time.</em><br />Our priority.</h1><p>Book appointments, track your place in line, and take control of your healthcare journey.</p><div className="hero-buttons"><button className="primary-btn" onClick={() => setMode('login')}>Book an appointment <ArrowRight size={17} /></button><button className="ghost-btn" onClick={() => setMode('login')}>Explore doctors</button></div><div className="trust-row"><div className="avatar-stack"><span>AK</span><span>JM</span><span>RS</span><span>+</span></div><div><strong>Trusted by 12,000+ patients</strong><small>Rated 4.9/5 by our community</small></div></div></div><div className="landing-visual"><div className="visual-glow" /><div className="doctor-portrait"><div className="portrait-circle">SW</div><div className="portrait-card"><span className="online-dot" />Dr. Sarah Wilson <small>Cardiologist</small></div></div><div className="floating-card queue-float"><div className="float-icon teal"><Activity /></div><div><small>Live queue</small><strong>3 patients ahead</strong></div><span className="trend">↓ 12 min</span></div><div className="floating-card appointment-float"><div className="float-icon blue"><CalendarDays /></div><div><small>Next appointment</small><strong>Today, 10:30 AM</strong></div><CheckCircle2 className="check" /></div></div></section><section className="landing-features" id="how-it-works"><div><ShieldCheck /><strong>Trusted care</strong><span>Verified medical professionals</span></div><div><Clock3 /><strong>Save your time</strong><span>Skip unnecessary waiting</span></div><div><Activity /><strong>Stay informed</strong><span>Real-time queue updates</span></div></section>{mode !== null && <div className="modal-backdrop"><form className="modal auth-modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">{mode === 'register' ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</span><h2>{mode === 'register' ? 'Create your account' : 'Sign in to MediQueue'}</h2></div><button type="button" className="icon-btn" onClick={() => { setMode(null); setMessage(''); }} aria-label="Close sign in"><X /></button></div>{mode === 'register' && <label>Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required /></label>{message && <p className="form-message">{message}</p>}<button className="primary-btn full">{mode === 'register' ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>{mode === 'login' && <button type="button" className="text-btn auth-link" onClick={forgot}>Forgot password?</button>}<button type="button" className="text-btn auth-link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create a patient account' : 'Already have an account? Sign in'}</button>{mode === 'login' && <p className="demo-hint">Demo accounts use password <strong>password123</strong></p>}</form></div>}</div>; }

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
