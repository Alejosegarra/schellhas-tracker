import { Role, JobStatus, JobPriority, type User, type Job, type Announcement } from '../types';
import { supabase } from './supabaseClient';

// --- Auth ---
export const apiGetLoginUsers = async (): Promise<Pick<User, 'id' | 'username'>[]> => {
    const { data, error } = await supabase.from('users').select('id, username');
    if (error) throw error;
    return data;
};

export const apiLogin = async (username: string, password: string): Promise<User | null> => {
    // ADVERTENCIA DE SEGURIDAD: Este método es inseguro y solo para fines de demostración.
    // En un entorno de producción, utiliza Supabase Auth.
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role')
        .eq('username', username)
        .eq('password', password) // Comparación en texto plano (NO SEGURO)
        .single();
    
    // El código de error 'PGRST116' significa que no se encontró ninguna fila, lo cual es un fallo de login esperado.
    if (error && error.code !== 'PGRST116') throw error;
    
    return data as User | null;
};

// --- Jobs ---
export const apiGetJobs = async (user: User): Promise<Job[]> => {
    let query = supabase.from('jobs').select('*');

    if (user.role === Role.Branch) {
        query = query.eq('branch_id', user.id);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) throw error;
    return (data as Job[]) || [];
};

export const apiCreateJob = async (jobData: { id: string; description: string; branch_id: string; branch_name: string }): Promise<Job> => {
    const now = new Date().toISOString();
    const newJob: Omit<Job, 'created_at' | 'updated_at'> = {
        ...jobData,
        status: JobStatus.PendingInBranch,
        priority: JobPriority.Normal,
        priority_message: '',
        history: [{
            timestamp: now,
            status: JobStatus.PendingInBranch,
            updatedBy: jobData.branch_name,
        }]
    };

    const { data, error } = await supabase
        .from('jobs')
        .insert(newJob)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') { // Error de violación de clave primaria (id duplicado)
            throw new Error('El número de trabajo ya existe.');
        }
        throw error;
    }
    return data as Job;
};

export const apiUpdateJob = async (jobId: string, updates: Partial<Omit<Job, 'id' | 'history'>>, updatedBy: User): Promise<Job> => {
    const { data: currentJob, error: fetchError } = await supabase.from('jobs').select('history, status, priority, description, priority_message').eq('id', jobId).single();
    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    const newHistory = [...currentJob.history];

    if (updates.status && updates.status !== currentJob.status) {
        newHistory.push({
            timestamp: now,
            status: updates.status,
            updatedBy: updatedBy.username,
        });
    }
    
    if('priority' in updates && updates.priority && updates.priority !== currentJob.priority){
        newHistory.push({
            timestamp: now,
            status: `PRIORIDAD CAMBIADA A ${updates.priority}`,
            updatedBy: updatedBy.username
        });
    }

    if(updatedBy.role === Role.Admin) {
        const adminChanges = Object.entries(updates)
            .filter(([key]) => !['status', 'priority', 'history', 'updated_at'].includes(key))
            .filter(([key, value]) => value !== currentJob[key as keyof typeof currentJob])
            .map(([key]) => key);
        
        if (adminChanges.length > 0) {
            newHistory.push({
                timestamp: now,
                status: `Admin actualizó: ${adminChanges.join(', ')}`,
                updatedBy: updatedBy.username,
            });
        }
    }


    const { data, error } = await supabase
        .from('jobs')
        .update({ ...updates, updated_at: now, history: newHistory })
        .eq('id', jobId)
        .select()
        .single();
    
    if (error) throw error;
    return data as Job;
};

export const apiDeleteJob = async (jobId: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('jobs').delete().eq('id', jobId);
    if (error) throw error;
    return { success: true };
};


export const apiBulkUpdateJobs = async (jobIds: string[], status: JobStatus, updatedBy: User): Promise<Job[]> => {
    const { data: currentJobs, error: fetchError } = await supabase.from('jobs').select('id, history').in('id', jobIds);
    if(fetchError) throw fetchError;
    
    const now = new Date().toISOString();
    const jobsToUpdate = currentJobs.map(job => ({
        ...job,
        status,
        updated_at: now,
        history: [...job.history, { timestamp: now, status, updatedBy: updatedBy.username }]
    }));

    const { data, error } = await supabase.from('jobs').upsert(jobsToUpdate).select();

    if (error) throw error;
    return data as Job[];
};

// --- Admin: Users ---
export const apiGetUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('id, username, role');
    if (error) throw error;
    return (data as User[]) || [];
};

export const apiGetStats = async (): Promise<{
    totalJobs: number;
    jobsByBranch: Record<string, number>;
    jobsByPriority: Record<JobPriority, number>;
}> => {
    const { data: allJobs, error } = await supabase.from('jobs').select('branch_name, priority');
    if (error) throw error;
    
    const jobsByBranch = allJobs.reduce((acc, job) => {
        acc[job.branch_name] = (acc[job.branch_name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const jobsByPriority = allJobs.reduce((acc, job) => {
        acc[job.priority] = (acc[job.priority] || 0) + 1;
        return acc;
    }, {} as Record<JobPriority, number>);
    
    return {
        totalJobs: allJobs.length,
        jobsByBranch,
        jobsByPriority,
    }
};

export const apiAddUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const { data, error } = await supabase.from('users').insert(userData).select().single();
    if (error) {
        if (error.code === '23505') { // Error de violación de unicidad
            throw new Error('El nombre de usuario ya existe.');
        }
        throw error;
    }
    return data as User;
};

export const apiUpdateUserPassword = async (id: string, newPassword: string):Promise<User> => {
    const { data, error } = await supabase.from('users').update({ password: newPassword }).eq('id', id).select().single();
    if (error) throw error;
    return data as User;
};

export const apiDeleteUser = async (id: string): Promise<{ success: true }> => {
    // Lógica para no eliminar al último admin
    const { data: userToDelete, error: fetchError } = await supabase.from('users').select('role').eq('id', id).single();
    if (fetchError) throw fetchError;
    if(userToDelete.role === Role.Admin){
        const { count } = await supabase.from('users').select('*', { count: 'exact' }).eq('role', Role.Admin);
        if (count === 1) {
            throw new Error('No se puede eliminar al último administrador.');
        }
    }
    
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
};

// --- Admin: Announcements ---
export const apiGetAnnouncements = async (): Promise<Announcement[]> => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data as Announcement[]) || [];
};

export const apiAddAnnouncement = async (message: string): Promise<Announcement> => {
    const { data, error } = await supabase.from('announcements').insert({ message }).select().single();
    if (error) throw error;
    return data as Announcement;
};

export const apiDeleteAnnouncement = async (id: string): Promise<{ success: boolean }> => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
};