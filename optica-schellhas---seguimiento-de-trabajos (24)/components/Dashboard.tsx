
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, useToast } from '../App.tsx';
import { Role, JobStatus, JobPriority, type User, type Job, type Announcement } from '../types.ts';
import * as api from '../services/api.ts';
import { supabase } from '../services/supabaseClient.ts';
import JobCard from './JobCard.tsx';
import { Button, Input, Modal, Card, CardHeader, CardContent, Select } from './common/UI.tsx';
import { EyeIcon, LogOutIcon, UsersIcon, PlusIcon, KeyIcon, TrashIcon, HistoryIcon, SearchIcon, BriefcaseIcon, AlertTriangleIcon, BranchIcon, InboxIcon, ClipboardListIcon, ChevronRightIcon, SendIcon, CheckIcon, CheckCircleIcon, TruckIcon, MegaphoneIcon, XIcon, EditIcon } from './common/Icons.tsx';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController);


// --- Announcements Banner ---
const AnnouncementsBanner: React.FC<{announcements: Announcement[], onClose: (id: string) => void}> = ({ announcements, onClose }) => {
    if (announcements.length === 0) return null;
    const [visible, setVisible] = useState(true);

    if (!visible) return null;

    return (
        <div className="bg-blue-600 text-white sticky top-[81px] z-30">
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <MegaphoneIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                        <p className="text-sm font-medium">{announcements[0].message}</p>
                    </div>
                    <button onClick={() => setVisible(false)} className="p-1 rounded-full hover:bg-blue-500">
                        <XIcon className="h-5 w-5"/>
                    </button>
                </div>
            </div>
        </div>
    )
}


// --- HELPER: Job History Modal ---
const JobHistoryModal: React.FC<{ job: Job | null; onClose: () => void }> = ({ job, onClose }) => {
    if (!job) return null;

    return (
        <Modal isOpen={!!job} onClose={onClose} title={`Historial del Trabajo #${job.id}`} size="lg">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="text-sm">
                    <p><strong>Descripción:</strong> {job.description || 'N/A'}</p>
                    <p><strong>Sucursal:</strong> {job.branch_name}</p>
                    <p><strong>Creado:</strong> {new Date(job.created_at).toLocaleString()}</p>
                </div>
                <ul className="space-y-3">
                    {[...(job.history || [])].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry, index) => (
                        <li key={index} className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                               <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">{entry.status}</p>
                                <p className="text-sm text-gray-500">
                                    Por <span className="font-medium">{entry.updatedBy}</span> el {new Date(entry.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </Modal>
    );
};


// --- MAIN DASHBOARD COMPONENT ---
const Dashboard: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);

    const fetchAnnouncements = useCallback(() => {
        api.apiGetAnnouncements().then(setAnnouncements);
    }, []);

    useEffect(() => {
        fetchAnnouncements();
        const channel = supabase
            .channel('public:announcements')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAnnouncements]);


    const renderContent = () => {
        if (!currentUser) return null;
        switch (currentUser.role) {
            case Role.Admin:
                return <AdminPanel announcements={announcements} onAnnouncementsUpdate={fetchAnnouncements} />;
            case Role.Branch:
                return <BranchView user={currentUser} />;
            case Role.Lab:
                return <LabView user={currentUser} />;
            default:
                return <p>Rol de usuario no reconocido.</p>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow-md sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <EyeIcon className="h-8 w-8 text-blue-600" />
                        <span className="text-xl font-bold text-gray-800 hidden sm:inline">Optica Schellhas</span>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                           <p className="font-semibold text-gray-700">{currentUser?.username}</p>
                           <p className="text-sm text-gray-500">
                                {currentUser?.role}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={logout} aria-label="Cerrar sesión">
                           <LogOutIcon className="h-6 w-6"/>
                        </Button>
                    </div>
                </div>
            </header>
            <AnnouncementsBanner announcements={announcements} onClose={() => {}}/>
            <main className="container mx-auto p-4 md:p-6">
                {renderContent()}
            </main>
        </div>
    );
};

// --- ADMIN PANEL ---
type AdminView = 'dashboard' | 'accounts' | 'announcements' | 'jobs';

const AdminPanel: React.FC<{announcements: Announcement[], onAnnouncementsUpdate: () => void}> = ({announcements, onAnnouncementsUpdate}) => {
    const [view, setView] = useState<AdminView>('dashboard');
    const [stats, setStats] = useState<{
        totalJobs: number;
        jobsByBranch: Record<string, number>;
        jobsByPriority: Record<JobPriority, number>;
    } | null>(null);

    const fetchStats = useCallback(() => api.apiGetStats().then(setStats), []);

    useEffect(() => {
        fetchStats();
        const channel = supabase
            .channel('public:jobs:stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchStats)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchStats]);

    const chartDataByBranch = useMemo(() => {
        if (!stats) return null;
        const labels = Object.keys(stats.jobsByBranch);
        const data = Object.values(stats.jobsByBranch);
        return {
            labels,
            datasets: [{
                label: 'Trabajos por Sucursal',
                data,
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
            }]
        };
    }, [stats]);
    
    const chartDataByPriority = useMemo(() => {
        if (!stats) return null;
        const priorityLabels = {
            [JobPriority.Normal]: 'Normal',
            [JobPriority.Urgente]: 'Urgente',
            [JobPriority.Repeticion]: 'Repetición'
        };
        const labels = Object.keys(stats.jobsByPriority).map(p => priorityLabels[p as JobPriority]).filter(Boolean);
        const data = Object.values(stats.jobsByPriority);
        return {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    'rgba(156, 163, 175, 0.7)',
                    'rgba(234, 179, 8, 0.7)',
                    'rgba(249, 115, 22, 0.7)'
                ],
                borderColor: [
                    'rgba(156, 163, 175, 1)',
                    'rgba(234, 179, 8, 1)',
                    'rgba(249, 115, 22, 1)'
                ],
                borderWidth: 1,
            }]
        };
    }, [stats]);


    return (
        <div>
            <div className="flex border-b border-gray-200 mb-6">
                {(['dashboard', 'accounts', 'announcements', 'jobs'] as AdminView[]).map(v => (
                    <button key={v} onClick={() => setView(v)} className={`capitalize py-2 px-4 text-sm md:text-base font-medium ${view === v ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>
                        {v === 'dashboard' ? 'Métricas' : v === 'accounts' ? 'Cuentas' : v === 'announcements' ? 'Anuncios' : 'Trabajos'}
                    </button>
                ))}
            </div>
            
            {view === 'dashboard' && (
                <div>
                     <h1 className="text-3xl font-bold text-gray-800 mb-6">Métricas del Sistema</h1>
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader><h3 className="font-bold text-lg">Trabajos por Sucursal</h3></CardHeader>
                            <CardContent>
                                {chartDataByBranch && <Bar data={chartDataByBranch} options={{ responsive: true, plugins: { legend: { display: false }}}} />}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><h3 className="font-bold text-lg">Distribución de Prioridades</h3></CardHeader>
                            <CardContent className="flex justify-center items-center h-full max-h-[300px] lg:max-h-full">
                                {chartDataByPriority && <Doughnut data={chartDataByPriority} options={{ responsive: true, maintainAspectRatio: false }}/>}
                            </CardContent>
                        </Card>
                     </div>
                </div>
            )}

            {view === 'accounts' && <ManageAccounts />}
            {view === 'announcements' && <ManageAnnouncements announcements={announcements} onUpdate={onAnnouncementsUpdate}/>}
            {view === 'jobs' && <ManageJobs />}
        </div>
    );
};

// --- Admin: Manage Jobs ---
interface EditJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    onSave: (updates: Partial<Omit<Job, 'id' | 'history'>>) => void;
}

const EditJobModal: React.FC<EditJobModalProps> = ({ isOpen, onClose, job, onSave }) => {
    const [description, setDescription] = useState(job.description);
    const [status, setStatus] = useState(job.status);
    const [priority, setPriority] = useState(job.priority);
    const [priorityMessage, setPriorityMessage] = useState(job.priority_message);

    useEffect(() => {
        if (job) {
            setDescription(job.description);
            setStatus(job.status);
            setPriority(job.priority);
            setPriorityMessage(job.priority_message);
        }
    }, [job]);

    const handleSave = () => {
        const updates: Partial<Omit<Job, 'id' | 'history'>> = {};
        if (description !== job.description) updates.description = description;
        if (status !== job.status) updates.status = status;
        if (priority !== job.priority) updates.priority = priority;
        if (priorityMessage !== job.priority_message) updates.priority_message = priorityMessage;

        if (Object.keys(updates).length > 0) {
            onSave(updates);
        } else {
            onClose(); // No changes
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Trabajo #${job.id}`}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Descripción</label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Estado</label>
                    <Select value={status} onChange={e => setStatus(e.target.value as JobStatus)}>
                        {Object.values(JobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Prioridad</label>
                    <Select value={priority} onChange={e => setPriority(e.target.value as JobPriority)}>
                         {Object.values(JobPriority).map(p => <option key={p} value={p}>{p}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Mensaje de Prioridad</label>
                    <Input value={priorityMessage} onChange={e => setPriorityMessage(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSave}>Guardar Cambios</Button>
                </div>
            </div>
        </Modal>
    );
}

const ManageJobs: React.FC = () => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingJob, setDeletingJob] = useState<Job | null>(null);
    const [viewingJobHistory, setViewingJobHistory] = useState<Job | null>(null);
    
    const fetchJobs = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const allJobs = await api.apiGetJobs(currentUser);
            setJobs(allJobs);
        } catch (error) {
            addToast('Error al cargar los trabajos.', 'error');
        } finally {
            setLoading(false);
        }
    }, [currentUser, addToast]);
    
    useEffect(() => {
        fetchJobs();
        const channel = supabase
            .channel('public:jobs:all')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchJobs)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchJobs]);

    const handleOpenEditModal = (job: Job) => {
        setEditingJob(job);
        setEditModalOpen(true);
    };

    const handleOpenDeleteModal = (job: Job) => {
        setDeletingJob(job);
        setDeleteModalOpen(true);
    };

    const handleUpdateJob = async (updates: Partial<Omit<Job, 'id' | 'history'>>) => {
        if (!editingJob || !currentUser) return;
        try {
            await api.apiUpdateJob(editingJob.id, updates, currentUser);
            addToast(`Trabajo #${editingJob.id} actualizado.`, 'success');
            setEditModalOpen(false);
            setEditingJob(null);
        } catch (error) {
            addToast('Error al actualizar el trabajo.', 'error');
        }
    };
    
    const handleDeleteJob = async () => {
        if (!deletingJob) return;
        try {
            await api.apiDeleteJob(deletingJob.id);
            addToast(`Trabajo #${deletingJob.id} eliminado.`, 'success');
            setDeleteModalOpen(false);
            setDeletingJob(null);
        } catch (error) {
            addToast('Error al eliminar el trabajo.', 'error');
        }
    };
    
    const filteredJobs = useMemo(() => {
        return jobs.filter(job => 
            job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.branch_name.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }, [jobs, searchTerm]);

    if (loading) return <div className="text-center p-8">Cargando trabajos...</div>;

    return (
        <div>
            <JobHistoryModal job={viewingJobHistory} onClose={() => setViewingJobHistory(null)} />
            <Card>
                <CardHeader>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center"><BriefcaseIcon className="h-6 w-6 mr-2 text-gray-600"/>Gestionar Todos los Trabajos</h2>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-6">
                        <Input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por Nº, descripción o sucursal..."
                            className="pl-10"
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto p-2 -m-2">
                        {filteredJobs.map(job => (
                            <JobCard 
                                key={job.id} 
                                job={job} 
                                user={currentUser!}
                                onUpdate={() => {}} // Not used by admin
                                onUpdatePriority={async () => {}} // Not used by admin
                                onViewHistory={setViewingJobHistory}
                                onEdit={handleOpenEditModal}
                                onDelete={handleOpenDeleteModal}
                                isSelected={false}
                                onSelect={() => {}}
                            />
                        ))}
                         {filteredJobs.length === 0 && <p className="text-center text-gray-500 py-8 col-span-full">No se encontraron trabajos.</p>}
                    </div>
                </CardContent>
            </Card>

            {editingJob && (
                <EditJobModal 
                    isOpen={isEditModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    job={editingJob}
                    onSave={handleUpdateJob}
                />
            )}
            
            {deletingJob && (
                 <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={`Eliminar Trabajo #${deletingJob.id}`}>
                    <div className="space-y-4">
                        <p className="text-gray-700">¿Está seguro de que desea eliminar permanentemente el trabajo <strong className="text-red-600">#{deletingJob.id} ({deletingJob.description})</strong>? Esta acción no se puede deshacer.</p>
                        <div className="flex justify-end space-x-2">
                            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleDeleteJob}>Eliminar</Button>
                        </div>
                    </div>
                 </Modal>
            )}
        </div>
    );
};


const ManageAnnouncements: React.FC<{announcements: Announcement[], onUpdate: () => void}> = ({announcements, onUpdate}) => {
    const [newMessage, setNewMessage] = useState('');
    const { addToast } = useToast();

    const handleAdd = async () => {
        if (!newMessage.trim()) return;
        try {
            await api.apiAddAnnouncement(newMessage.trim());
            addToast('Anuncio creado.', 'success');
            setNewMessage('');
            // Realtime will trigger the update
        } catch (error) {
            addToast('Error al crear anuncio.', 'error');
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await api.apiDeleteAnnouncement(id);
            addToast('Anuncio eliminado.', 'success');
            // Realtime will trigger the update
        } catch (error) {
            addToast('Error al eliminar anuncio.', 'error');
        }
    };

    return (
        <Card>
             <CardHeader>
                 <h2 className="text-xl font-bold text-gray-800 flex items-center"><MegaphoneIcon className="h-6 w-6 mr-2 text-gray-600"/>Gestionar Anuncios</h2>
             </CardHeader>
             <CardContent>
                <div className="flex gap-2 mb-6">
                    <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Nuevo anuncio..."/>
                    <Button onClick={handleAdd}>Añadir</Button>
                </div>
                <ul className="space-y-3">
                    {announcements.map(ann => (
                        <li key={ann.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-gray-800">{ann.message}</p>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(ann.id)}><TrashIcon className="h-5 w-5 text-red-500"/></Button>
                        </li>
                    ))}
                    {announcements.length === 0 && <p className="text-gray-500 text-center py-4">No hay anuncios activos.</p>}
                </ul>
             </CardContent>
        </Card>
    )
}

// Admin: Manage Accounts
const ManageAccounts: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

    const [username, setUsername] = useState('');
    const [role, setRole] = useState<Role>(Role.Branch);
    const [password, setPassword] = useState('123');
    const { addToast } = useToast();

    const fetchUsers = useCallback(async () => {
        setUsers(await api.apiGetUsers());
    }, []);

    useEffect(() => {
        fetchUsers();
        const channel = supabase
            .channel('public:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchUsers)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchUsers]);
    
    const handleOpenUserModal = () => {
        setUsername('');
        setRole(Role.Branch);
        setPassword('123');
        setUserModalOpen(true);
    };

    const handleOpenPasswordModal = (user: User) => {
        setEditingUser(user);
        setPassword('');
        setPasswordModalOpen(true);
    };

    const handleOpenDeleteModal = (user: User) => {
        setDeletingUser(user);
        setDeleteConfirmationText('');
        setDeleteModalOpen(true);
    };


    const handleSaveUser = async () => {
        try {
            await api.apiAddUser({ username, password, role });
            addToast(`Cuenta '${username}' creada exitosamente.`, 'success');
            setUserModalOpen(false);
        } catch (error: any) {
            addToast(error.message, 'error');
        }
    };
    
    const handleSavePassword = async () => {
        if (editingUser && password) {
            await api.apiUpdateUserPassword(editingUser.id, password);
            addToast(`Contraseña para '${editingUser.username}' actualizada.`, 'success');
            setPasswordModalOpen(false);
        }
    };
    
    const handleConfirmDelete = async () => {
        if (deletingUser && deleteConfirmationText === deletingUser.username) {
            try {
                await api.apiDeleteUser(deletingUser.id);
                addToast(`Cuenta '${deletingUser.username}' eliminada.`, 'success');
                setDeleteModalOpen(false);
                setDeletingUser(null);
            } catch (error: any) {
                addToast(error.message, 'error');
            }
        }
    };

    return (
        <Card>
            <CardHeader className="flex justify-between items-center">
                 <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center"><UsersIcon className="h-6 w-6 mr-2 text-gray-600"/>Gestionar Cuentas</h2>
                </div>
                <Button onClick={handleOpenUserModal}><PlusIcon className="h-5 w-5 mr-2"/>Añadir Cuenta</Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b">
                                <th className="p-3 font-semibold text-gray-700">Nombre de Usuario / Sucursal</th>
                                <th className="p-3 font-semibold text-gray-700">Rol</th>
                                <th className="p-3 font-semibold text-gray-700 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium text-gray-900">{user.username}</td>
                                    <td className="p-3 text-gray-600">{user.role}</td>
                                    <td className="p-3 text-right space-x-1">
                                        <Button variant="ghost" size="sm" onClick={() => handleOpenPasswordModal(user)} title="Cambiar contraseña">
                                            <KeyIcon className="h-5 w-5 text-gray-600"/>
                                        </Button>
                                         <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteModal(user)} title="Eliminar cuenta">
                                            <TrashIcon className="h-5 w-5 text-red-500"/>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>

            <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title="Añadir Nueva Cuenta">
                 <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre de Usuario / Sucursal</label>
                        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Ej: Nueva Sucursal" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Rol</label>
                        <Select value={role} onChange={e => setRole(e.target.value as Role)}>
                            <option value={Role.Branch}>Sucursal</option>
                            <option value={Role.Lab}>Laboratorio</option>
                            <option value={Role.Admin}>Administrador</option>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                        <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" type="password"/>
                    </div>
                    <Button onClick={handleSaveUser} className="w-full">Crear Cuenta</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)} title={`Cambiar contraseña para ${editingUser?.username}`}>
                 <div className="space-y-4">
                    <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Nueva contraseña" type="password" autoFocus/>
                    <Button onClick={handleSavePassword} className="w-full">Actualizar Contraseña</Button>
                </div>
            </Modal>

            <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={`Eliminar cuenta`}>
                 <div className="space-y-4">
                    <p className="text-gray-700">
                        Esta acción es irreversible. Para confirmar, por favor escriba <strong className="text-red-600">{deletingUser?.username}</strong> en el campo de abajo.
                    </p>
                    <Input 
                        value={deleteConfirmationText} 
                        onChange={e => setDeleteConfirmationText(e.target.value)}
                        placeholder="Escriba el nombre para confirmar" 
                        autoFocus
                    />
                    <Button 
                        onClick={handleConfirmDelete} 
                        className="w-full" 
                        variant="danger"
                        disabled={deleteConfirmationText !== deletingUser?.username}
                    >
                        Eliminar permanentemente
                    </Button>
                </div>
            </Modal>
        </Card>
    );
};


// --- BRANCH VIEW ---
const BranchView: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobNumber, setJobNumber] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');
    const { addToast } = useToast();

    const fetchJobs = useCallback(async () => {
        const data = await api.apiGetJobs(user);
        setJobs(data);
    }, [user]);

    useEffect(() => {
        fetchJobs();
        const channel = supabase
            .channel(`branch-jobs-channel-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `branch_id=eq.${user.id}` },
            (payload) => {
                console.log('Change received!', payload)
                fetchJobs();
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel);
        }
    }, [fetchJobs, user.id]);
    
    const handleCreateJob = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await api.apiCreateJob({ id: jobNumber, description, branch_id: user.id, branch_name: user.username });
            addToast(`Trabajo #${jobNumber} creado exitosamente.`, 'success');
            setJobNumber('');
            setDescription('');
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleUpdate = async (jobId: string, status: JobStatus) => {
        await api.apiUpdateJob(jobId, { status }, user);
        addToast(`Trabajo #${jobId} actualizado.`, 'success');
    };
    
    const handleUpdatePriority = async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
    };

    const handleSelectJob = (jobId: string, isSelected: boolean) => {
        setSelectedJobIds(prev => isSelected ? [...prev, jobId] : prev.filter(id => id !== jobId));
    };

    const { activeJobs, historicalJobs, groupedJobs } = useMemo(() => {
        const historical = [];
        const active = [];
        for(const job of jobs) {
            if (job.status === JobStatus.Completed || job.status === JobStatus.SentToBranch) {
                historical.push(job);
            } else {
                active.push(job);
            }
        }
        
        const filteredActive = statusFilter === 'ALL'
            ? active
            : active.filter(job => job.status === statusFilter);

        const grouped = filteredActive.reduce((acc, job) => {
            if (!acc[job.status]) acc[job.status] = [];
            acc[job.status].push(job);
            return acc;
        }, {} as Record<JobStatus, Job[]>);

        return { activeJobs: filteredActive, historicalJobs: historical, groupedJobs: grouped };
    }, [jobs, statusFilter]);

    const pendingJobs = groupedJobs[JobStatus.PendingInBranch] || [];
    const jobsToSend = selectedJobIds.filter(id => pendingJobs.some(j => j.id === id));
    
    const handleBulkSendToLab = async () => {
        if (jobsToSend.length === 0) return;
        await api.apiBulkUpdateJobs(jobsToSend, JobStatus.SentToLab, user);
        addToast(`${jobsToSend.length} trabajos enviados al laboratorio.`, 'success');
        setSelectedJobIds([]);
    };


    const filteredHistoricalJobs = useMemo(() => {
        if (!historySearchTerm) return historicalJobs;
        const term = historySearchTerm.toLowerCase();
        return historicalJobs.filter(job => 
            job.id.toLowerCase().includes(term) ||
            job.description.toLowerCase().includes(term)
        );
    }, [historicalJobs, historySearchTerm]);


    const statusOrder: JobStatus[] = [JobStatus.PendingInBranch, JobStatus.SentToLab, JobStatus.ReceivedByLab];

    const filterOptions: { value: JobStatus | 'ALL'; label: string }[] = [
        { value: 'ALL', label: 'Todos Activos' },
        { value: JobStatus.PendingInBranch, label: 'Pendiente en Sucursal' },
        { value: JobStatus.SentToLab, label: 'Enviado a Laboratorio' },
        { value: JobStatus.ReceivedByLab, label: 'Recibido en Laboratorio' },
    ];

    return (
        <div className="space-y-8">
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            <Card>
                <CardHeader><h2 className="text-xl font-bold">Crear Nuevo Trabajo</h2></CardHeader>
                <CardContent>
                    <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Nº de Trabajo</label>
                            <Input value={jobNumber} onChange={e => setJobNumber(e.target.value)} required placeholder="Ej: 12345"/>
                        </div>
                         <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Progresivo antireflex, etc."/>
                        </div>
                        <div className="md:col-span-1">
                            <Button type="submit" className="w-full"><PlusIcon className="h-5 w-5 mr-2"/>Crear</Button>
                        </div>
                    </form>
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                </CardContent>
            </Card>

            {jobsToSend.length > 0 && (
                <div className="sticky top-[82px] z-30 bg-blue-100 p-3 rounded-lg shadow-md flex justify-between items-center">
                    <p className="font-semibold text-blue-800">{jobsToSend.length} trabajo(s) seleccionado(s).</p>
                    <Button onClick={handleBulkSendToLab}>
                        <SendIcon className="h-4 w-4 mr-2"/> Enviar seleccionados al Laboratorio
                    </Button>
                </div>
            )}


            <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-4 mb-3">
                    <h2 className="text-xl font-semibold text-gray-700 mr-4 whitespace-nowrap">Trabajos Activos</h2>
                     <div className="flex flex-wrap gap-2">
                        {filterOptions.map(option => (
                            <button
                                key={option.value}
                                onClick={() => setStatusFilter(option.value)}
                                className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
                                    statusFilter === option.value
                                        ? 'bg-blue-600 text-white shadow'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {activeJobs.length > 0 ? (
                    statusOrder.map(status => (
                        groupedJobs[status] && groupedJobs[status].length > 0 && (
                            <div key={status}>
                                 <h2 className="text-xl font-semibold mb-3 text-gray-700">{status}</h2>
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {groupedJobs[status].map(job => (
                                        <JobCard 
                                            key={job.id} 
                                            job={job} 
                                            user={user}
                                            onUpdate={() => handleUpdate(job.id, JobStatus.SentToLab)}
                                            onUpdatePriority={handleUpdatePriority}
                                            onViewHistory={setViewingJob}
                                            isSelected={selectedJobIds.includes(job.id)}
                                            onSelect={handleSelectJob}
                                        />
                                    ))}
                                </div>
                            </div>
                        )
                    ))
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No hay trabajos activos que coincidan con el filtro seleccionado.</p>
                    </div>
                )}
            </div>
            
            <div className="space-y-4">
                <div className="border-t pt-8">
                     <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center"><HistoryIcon className="h-6 w-6 mr-3 text-gray-500"/>Historial de Trabajos</h2>
                     <div className="relative">
                        <Input 
                            value={historySearchTerm}
                            onChange={e => setHistorySearchTerm(e.target.value)}
                            placeholder="Buscar en historial por Nº o descripción..."
                            className="pl-10"
                        />
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                    </div>
                </div>

                 {filteredHistoricalJobs.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredHistoricalJobs.map(job => (
                            <JobCard 
                                key={job.id} 
                                job={job} 
                                user={user}
                                onUpdate={() => {}}
                                onUpdatePriority={handleUpdatePriority}
                                onViewHistory={setViewingJob}
                                isSelected={false} // No selection in history
                                onSelect={() => {}}
                            />
                        ))}
                    </div>
                 ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No hay trabajos en el historial que coincidan con su búsqueda.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};


// --- LAB VIEW ---
type LabViewMode = 'dashboard' | 'list';

const LabView: React.FC<{ user: User }> = ({ user }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [mode, setMode] = useState<LabViewMode>('dashboard');

    const fetchJobs = useCallback(async () => {
        const data = await api.apiGetJobs(user);
        setJobs(data);
    }, [user]);

    useEffect(() => {
        fetchJobs();
        const channel = supabase
            .channel('lab-jobs-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchJobs)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchJobs]);

    const stats = useMemo(() => {
        return {
            sentToLab: jobs.filter(j => j.status === JobStatus.SentToLab).length,
            inProgress: jobs.filter(j => j.status === JobStatus.ReceivedByLab).length,
            withAlerts: jobs.filter(j => j.priority !== JobPriority.Normal && (j.status === JobStatus.SentToLab || j.status === JobStatus.ReceivedByLab)).length
        }
    }, [jobs]);

    if (mode === 'dashboard') {
        return (
             <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-6">Panel de Laboratorio</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard icon={<InboxIcon/>} title="Nuevos para Recibir" value={stats.sentToLab} />
                    <StatCard icon={<BriefcaseIcon/>} title="Trabajos en Proceso" value={stats.inProgress} color="text-indigo-500" />
                    <StatCard icon={<AlertTriangleIcon/>} title="Prioridades Activas" value={stats.withAlerts} color="text-yellow-500" />
                </div>
                <div className="mt-8">
                    <Card className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setMode('list')}>
                        <CardContent className="flex items-center justify-between">
                            <div className="flex items-center">
                                <ClipboardListIcon className="h-8 w-8 text-blue-600 mr-4"/>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">Ver todos los trabajos</h3>
                                    <p className="text-gray-600">Gestionar los trabajos por estado.</p>
                                </div>
                            </div>
                            <ChevronRightIcon className="h-6 w-6 text-gray-400"/>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }
    
    return <LabJobsList user={user} jobs={jobs} setJobs={setJobs} onBack={() => setMode('dashboard')} />;
};

const StatCard: React.FC<{icon: React.ReactElement<{ className?: string }>, title: string, value: number, color?: string}> = ({icon, title, value, color='text-blue-600'}) => (
    <Card>
        <CardContent className="flex items-center">
            <div className={`mr-4 text-3xl ${color}`}>
                {React.cloneElement(icon, { className: 'h-10 w-10' })}
            </div>
            <div>
                <p className="text-gray-500 text-sm font-medium">{title}</p>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
            </div>
        </CardContent>
    </Card>
)

type LabViewTab = JobStatus | 'HISTORY';

const LabJobsList: React.FC<{user: User, jobs: Job[], setJobs: React.Dispatch<React.SetStateAction<Job[]>>, onBack: () => void}> = ({ user, jobs, setJobs, onBack }) => {
    const [activeTab, setActiveTab] = useState<LabViewTab>(JobStatus.SentToLab);
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [viewingJob, setViewingJob] = useState<Job | null>(null);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const { addToast } = useToast();

    const handleUpdate = useCallback(async (jobId: string, currentStatus: JobStatus) => {
        let nextStatus: JobStatus | null = null;
        if(currentStatus === JobStatus.SentToLab) nextStatus = JobStatus.ReceivedByLab;
        if(currentStatus === JobStatus.ReceivedByLab) nextStatus = JobStatus.Completed;
        if(currentStatus === JobStatus.Completed) nextStatus = JobStatus.SentToBranch;
        
        if (nextStatus) {
            await api.apiUpdateJob(jobId, { status: nextStatus }, user);
            addToast(`Trabajo #${jobId} actualizado a ${nextStatus}.`, 'success');
        }
    }, [user, addToast]);
    
    const handleBulkUpdate = useCallback(async () => {
        const jobsToUpdate = selectedJobIds.filter(id => jobs.some(j => j.id === id && j.status === activeTab));
        if (jobsToUpdate.length === 0) return;

        let nextStatus: JobStatus | null = null;
        if(activeTab === JobStatus.SentToLab) nextStatus = JobStatus.ReceivedByLab;
        if(activeTab === JobStatus.ReceivedByLab) nextStatus = JobStatus.Completed;
        if(activeTab === JobStatus.Completed) nextStatus = JobStatus.SentToBranch;

        if (nextStatus) {
            await api.apiBulkUpdateJobs(jobsToUpdate, nextStatus, user);
            addToast(`${jobsToUpdate.length} trabajos actualizados a ${nextStatus}.`, 'success');
            setSelectedJobIds([]);
        }
    }, [activeTab, jobs, selectedJobIds, user, addToast]);

    const handleUpdatePriority = useCallback(async (jobId: string, priority: JobPriority, message: string) => {
        await api.apiUpdateJob(jobId, { priority, priority_message: message }, user);
        addToast(`Prioridad del trabajo #${jobId} actualizada.`, 'success');
    }, [user, addToast]);
    
     const handleSelectJob = (jobId: string, isSelected: boolean) => {
        setSelectedJobIds(prev => isSelected ? [...prev, jobId] : prev.filter(id => id !== jobId));
    };

    const filteredJobs = useMemo(() => {
        if (activeTab === 'HISTORY') {
            const historicalJobs = jobs.filter(job => job.status === JobStatus.Completed || job.status === JobStatus.SentToBranch);
            if (!historySearchTerm) return historicalJobs;
            const term = historySearchTerm.toLowerCase();
            return historicalJobs.filter(job => 
                job.id.toLowerCase().includes(term) ||
                job.description.toLowerCase().includes(term) ||
                job.branch_name.toLowerCase().includes(term)
            );
        }
        return jobs.filter(job => job.status === activeTab);
    }, [jobs, activeTab, historySearchTerm]);


    const tabs: {status: LabViewTab, label: string}[] = [
        {status: JobStatus.SentToLab, label: "Recibidos de Sucursal"},
        {status: JobStatus.ReceivedByLab, label: "En Proceso"},
        {status: JobStatus.Completed, label: "Terminados"},
        {status: 'HISTORY', label: "Historial"}
    ];
    
    const jobsForBulkAction = selectedJobIds.filter(id => filteredJobs.some(j => j.id === id));
    const bulkActionInfo = useMemo(() => {
        switch(activeTab) {
            case JobStatus.SentToLab: return { label: 'Marcar como Recibidos', icon: <CheckIcon className="h-4 w-4 mr-2"/>};
            case JobStatus.ReceivedByLab: return { label: 'Marcar como Terminados', icon: <CheckCircleIcon className="h-4 w-4 mr-2"/>};
            case JobStatus.Completed: return { label: 'Enviar a Sucursal', icon: <TruckIcon className="h-4 w-4 mr-2"/>};
            default: return null;
        }
    }, [activeTab]);


    const getTabCount = (status: LabViewTab) => {
        if (status === 'HISTORY') {
            return jobs.filter(j => j.status === JobStatus.Completed || j.status === JobStatus.SentToBranch).length;
        }
        return jobs.filter(j => j.status === status).length;
    };


    return (
        <div>
            <JobHistoryModal job={viewingJob} onClose={() => setViewingJob(null)} />
            <Button variant="ghost" onClick={onBack} className="mb-4 -ml-4">&larr; Volver al Panel</Button>
            
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
                {tabs.map(tab => (
                     <button 
                        key={tab.status}
                        onClick={() => {
                            setActiveTab(tab.status)
                            setSelectedJobIds([]);
                        }} 
                        className={`py-2 px-4 text-sm md:text-base font-medium whitespace-nowrap ${activeTab === tab.status ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    >
                        {tab.label} ({getTabCount(tab.status)})
                    </button>
                ))}
            </div>
            
            {jobsForBulkAction.length > 0 && bulkActionInfo && (
                <div className="sticky top-[82px] z-30 bg-blue-100 p-3 rounded-lg shadow-md flex justify-between items-center mb-6">
                    <p className="font-semibold text-blue-800">{jobsForBulkAction.length} trabajo(s) seleccionado(s).</p>
                    <Button onClick={handleBulkUpdate}>
                       {bulkActionInfo.icon} {bulkActionInfo.label}
                    </Button>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="relative mb-6">
                    <Input 
                        value={historySearchTerm}
                        onChange={e => setHistorySearchTerm(e.target.value)}
                        placeholder="Buscar en historial por Nº, descripción o sucursal..."
                        className="pl-10"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                </div>
            )}

            {filteredJobs.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredJobs.map(job => (
                        <JobCard 
                            key={job.id} 
                            job={job} 
                            user={user}
                            onUpdate={() => handleUpdate(job.id, job.status)}
                            onUpdatePriority={handleUpdatePriority}
                            onViewHistory={setViewingJob}
                            isSelected={selectedJobIds.includes(job.id)}
                            onSelect={activeTab !== 'HISTORY' ? handleSelectJob : () => {}}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No hay trabajos en este estado.</p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;