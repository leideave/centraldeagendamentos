import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  where
} from 'firebase/firestore';
import { db, auth, handleFirestoreError } from './lib/firebase';
import { User, UserRole, Appointment, AppointmentStatus, DeletedAppointment } from './types';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/card';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Badge } from './components/ui/badge';
import { Textarea } from './components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Toaster, toast } from 'sonner';
import { format, isAfter, subMinutes, parseISO, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { LogOut, Plus, Search, Calendar as CalendarIcon, Phone, BookOpen, Trash2, Edit2, FileText, Bell, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Mock credentials mapping
const CREDENTIALS: Record<string, { name: string; role: UserRole }> = {
  '121520': { name: 'Colaborador 1', role: 'colaborador' },
  '121530': { name: 'Colaborador 2', role: 'colaborador' },
  '121540': { name: 'Central 1', role: 'central' },
  '121552': { name: 'Central 2', role: 'central' },
  'adm101010': { name: 'Administrador', role: 'admin' },
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [deletedAppointments, setDeletedAppointments] = useState<DeletedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = CREDENTIALS[password];
    if (user) {
      const userData: User = {
        uid: password, // Using password as UID for this mock setup
        name: user.name,
        role: user.role,
      };
      setCurrentUser(userData);
      localStorage.setItem('icpro_user', JSON.stringify(userData));
      toast.success(`Bem-vindo, ${user.name}!`);
    } else {
      toast.error('Senha incorreta');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('icpro_user');
    toast.info('Sessão encerrada');
  };

  // Load user from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem('icpro_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Real-time sync for appointments
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'appointments'), orderBy('time', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(docs);
    }, (error) => {
      handleFirestoreError(error, 'list', 'appointments');
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time sync for deleted appointments (admin only)
  useEffect(() => {
    if (currentUser?.role !== 'admin') return;

    const q = query(collection(db, 'deleted_appointments'), orderBy('deletedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeletedAppointment));
      setDeletedAppointments(docs);
    }, (error) => {
      handleFirestoreError(error, 'list', 'deleted_appointments');
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Alarm feature: Check for appointments in 10 minutes
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;

    const interval = setInterval(() => {
      const now = new Date();
      appointments.forEach(app => {
        const appTime = parseISO(app.time);
        const alarmTime = subMinutes(appTime, 10);
        
        // If it's exactly 10 minutes before (within a 1-minute window to avoid missing it)
        if (isAfter(now, alarmTime) && isAfter(appTime, now) && app.status === 'pendente') {
          // Check if we already notified for this appointment in this session
          const notifiedKey = `notified_${app.id}`;
          if (!sessionStorage.getItem(notifiedKey)) {
            toast.warning(`Alarme: Agendamento de ${app.clientName} em 10 minutos!`, {
              duration: 10000,
              icon: <Bell className="h-5 w-5" />,
            });
            // Play a sound if possible (browsers might block it)
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
            sessionStorage.setItem(notifiedKey, 'true');
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [appointments, currentUser]);

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-600">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">CENTRAL AGENDAMENTO ICPRO</CardTitle>
            <CardDescription>Insira sua senha para acessar o sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg">
                Entrar no Sistema
              </Button>
            </form>
          </CardContent>
        </Card>
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            <h1 className="font-bold text-lg hidden sm:block">CENTRAL AGENDAMENTO ICPRO</h1>
            <h1 className="font-bold text-lg sm:hidden">ICPRO</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {currentUser.role === 'colaborador' && (
          <ColaboradorView 
            user={currentUser} 
            appointments={appointments} 
          />
        )}
        {currentUser.role === 'central' && (
          <CentralView 
            user={currentUser} 
            appointments={appointments} 
          />
        )}
        {currentUser.role === 'admin' && (
          <AdminView 
            user={currentUser} 
            appointments={appointments} 
            deletedAppointments={deletedAppointments}
          />
        )}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}

// --- VIEW COMPONENTS ---

function ColaboradorView({ user, appointments }: { user: User, appointments: Appointment[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);

  const filteredApps = appointments.filter(app => app.createdBy === user.uid);

  const handleAddOrUpdate = async (data: Partial<Appointment>) => {
    try {
      if (editingApp) {
        await updateDoc(doc(db, 'appointments', editingApp.id), {
          ...data,
          updatedAt: new Date().toISOString()
        });
        toast.success('Agendamento atualizado!');
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...data,
          status: 'pendente',
          createdBy: user.uid,
          creatorName: user.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          observations: ''
        });
        toast.success('Cliente cadastrado com sucesso!');
      }
      setIsAddOpen(false);
      setEditingApp(null);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message?.includes('permission-denied') 
        ? 'Erro de permissão: Você não tem autorização para esta ação.' 
        : 'Erro ao salvar agendamento. Verifique os dados e tente novamente.';
      toast.error(errorMessage);
      handleFirestoreError(error, 'write', 'appointments');
    }
  };

  const handleDelete = async (app: Appointment) => {
    if (!confirm(`Deseja realmente excluir o agendamento de ${app.clientName}?`)) return;
    
    try {
      // Save to deleted_appointments first
      await addDoc(collection(db, 'deleted_appointments'), {
        appointmentData: app,
        deletedBy: user.uid,
        deletedByName: user.name,
        deletedAt: new Date().toISOString()
      });
      
      // Delete from active
      await deleteDoc(doc(db, 'appointments', app.id));
      toast.info('Agendamento excluído e arquivado.');
    } catch (error) {
      handleFirestoreError(error, 'delete', 'appointments');
    }
  };

  const handleReschedule = (app: Appointment) => {
    setEditingApp({
      ...app,
      rescheduledFrom: app.id,
      status: 'pendente'
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Meus Agendamentos</h2>
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) setEditingApp(null); }}>
          <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700" />}>
            <Plus className="mr-2 h-4 w-4" /> Novo Cadastro
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingApp ? (editingApp.rescheduledFrom ? 'Remarcar Horário' : 'Editar Cadastro') : 'Novo Cadastro de Cliente'}</DialogTitle>
            </DialogHeader>
            <AppointmentForm 
              initialData={editingApp || undefined} 
              onSubmit={handleAddOrUpdate} 
              onCancel={() => setIsAddOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {filteredApps.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
            <p>Nenhum agendamento encontrado.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredApps.map(app => (
              <AppointmentCard 
                key={app.id} 
                app={app} 
                onEdit={() => { setEditingApp(app); setIsAddOpen(true); }}
                onDelete={() => handleDelete(app)}
                onReschedule={() => handleReschedule(app)}
                showActions
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CentralView({ user, appointments }: { user: User, appointments: Appointment[] }) {
  const [selectedApp, setSelectedApp] = useState<Appointment | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<{ status: AppointmentStatus, obs: string } | null>(null);

  const handleUpdateStatus = async () => {
    if (!selectedApp || !statusUpdate) return;
    if (!statusUpdate.obs.trim()) {
      toast.error('A observação é obrigatória!');
      return;
    }

    try {
      await updateDoc(doc(db, 'appointments', selectedApp.id), {
        status: statusUpdate.status,
        observations: statusUpdate.obs,
        updatedAt: new Date().toISOString()
      });
      toast.success('Status atualizado com sucesso!');
      setSelectedApp(null);
      setStatusUpdate(null);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message?.includes('permission-denied') 
        ? 'Erro de permissão: Você não tem autorização para esta ação.' 
        : 'Erro ao atualizar status.';
      toast.error(errorMessage);
      handleFirestoreError(error, 'write', 'appointments');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Painel da Central</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map(app => (
          <AppointmentCard 
            key={app.id} 
            app={app} 
            onAction={() => setSelectedApp(app)}
            actionLabel="Atualizar Status"
          />
        ))}
      </div>

      <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Status: {selectedApp?.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={statusUpdate?.status === 'compareceu' ? 'default' : 'outline'}
                onClick={() => setStatusUpdate({ status: 'compareceu', obs: statusUpdate?.obs || '' })}
                className="justify-start"
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Compareceu
              </Button>
              <Button 
                variant={statusUpdate?.status === 'nao_compareceu' ? 'default' : 'outline'}
                onClick={() => setStatusUpdate({ status: 'nao_compareceu', obs: statusUpdate?.obs || '' })}
                className="justify-start"
              >
                <XCircle className="mr-2 h-4 w-4 text-red-500" /> Não Compareceu
              </Button>
              <Button 
                variant={statusUpdate?.status === 'inscreveu' ? 'default' : 'outline'}
                onClick={() => setStatusUpdate({ status: 'inscreveu', obs: statusUpdate?.obs || '' })}
                className="justify-start"
              >
                <Edit2 className="mr-2 h-4 w-4 text-blue-500" /> Se Inscreveu
              </Button>
              <Button 
                variant={statusUpdate?.status === 'nao_fechou_matricula' ? 'default' : 'outline'}
                onClick={() => setStatusUpdate({ status: 'nao_fechou_matricula', obs: statusUpdate?.obs || '' })}
                className="justify-start"
              >
                <AlertCircle className="mr-2 h-4 w-4 text-orange-500" /> Não Fechou Matrícula
              </Button>
              <Button 
                variant={statusUpdate?.status === 'matriculado' ? 'default' : 'outline'}
                onClick={() => setStatusUpdate({ status: 'matriculado', obs: statusUpdate?.obs || '' })}
                className="justify-start col-span-2"
              >
                <BookOpen className="mr-2 h-4 w-4 text-purple-500" /> Matriculado
              </Button>
            </div>

            {statusUpdate && (
              <div className="space-y-2">
                <Label>Observações (Obrigatório)</Label>
                <Textarea 
                  placeholder="Descreva o motivo ou detalhes..." 
                  value={statusUpdate.obs}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, obs: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApp(null)}>Cancelar</Button>
            <Button onClick={handleUpdateStatus} disabled={!statusUpdate}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminView({ user, appointments, deletedAppointments }: { user: User, appointments: Appointment[], deletedAppointments: DeletedAppointment[] }) {
  const [period, setPeriod] = useState({ start: format(startOfDay(new Date()), "yyyy-MM-dd'T'HH:mm"), end: format(endOfDay(new Date()), "yyyy-MM-dd'T'HH:mm") });

  const filteredApps = appointments.filter(app => {
    const appTime = parseISO(app.time);
    return isWithinInterval(appTime, { start: parseISO(period.start), end: parseISO(period.end) });
  });

  const filteredDeleted = deletedAppointments.filter(app => {
    const delTime = parseISO(app.deletedAt);
    return isWithinInterval(delTime, { start: parseISO(period.start), end: parseISO(period.end) });
  });

  const stats = {
    total: filteredApps.length,
    matriculados: filteredApps.filter(a => a.status === 'matriculado').length,
    compareceram: filteredApps.filter(a => a.status === 'compareceu').length,
    faltaram: filteredApps.filter(a => a.status === 'nao_compareceu').length,
    excluidos: filteredDeleted.length
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório CENTRAL AGENDAMENTO ICPRO', 14, 15);
    doc.text(`Período: ${format(parseISO(period.start), 'dd/MM/yyyy HH:mm')} até ${format(parseISO(period.end), 'dd/MM/yyyy HH:mm')}`, 14, 25);
    
    const tableData = filteredApps.map(app => [
      app.clientName,
      format(parseISO(app.time), 'dd/MM/yyyy HH:mm'),
      app.course,
      app.status,
      app.creatorName,
      app.observations
    ]);

    (doc as any).autoTable({
      head: [['Cliente', 'Horário', 'Curso', 'Status', 'Cadastrado por', 'Obs']],
      body: tableData,
      startY: 35,
    });

    doc.save(`relatorio_icpro_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Painel Administrativo</h2>
        <Button onClick={exportPDF} variant="outline">
          <FileText className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro de Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-2">
            <Label>Início</Label>
            <Input type="datetime-local" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
          </div>
          <div className="flex-1 space-y-2">
            <Label>Fim</Label>
            <Input type="datetime-local" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} color="blue" />
        <StatCard label="Matriculados" value={stats.matriculados} color="purple" />
        <StatCard label="Compareceram" value={stats.compareceram} color="green" />
        <StatCard label="Faltaram" value={stats.faltaram} color="red" />
        <StatCard label="Excluídos" value={stats.excluidos} color="slate" />
      </div>

      <Tabs defaultValue="ativos">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ativos">Agendamentos Ativos</TabsTrigger>
          <TabsTrigger value="excluidos">Histórico de Excluídos</TabsTrigger>
        </TabsList>
        <TabsContent value="ativos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado por</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.map(app => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.clientName}</TableCell>
                    <TableCell>{format(parseISO(app.time), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>{app.course}</TableCell>
                    <TableCell><StatusBadge status={app.status} /></TableCell>
                    <TableCell>{app.creatorName}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{app.observations || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="excluidos">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Excluído por</TableHead>
                  <TableHead>Data Exclusão</TableHead>
                  <TableHead>Dados Originais</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeleted.map(del => (
                  <TableRow key={del.id}>
                    <TableCell className="font-medium">{del.appointmentData.clientName}</TableCell>
                    <TableCell>{del.deletedByName}</TableCell>
                    <TableCell>{format(parseISO(del.deletedAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {del.appointmentData.course} - {format(parseISO(del.appointmentData.time), 'dd/MM/yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- HELPER COMPONENTS ---

function AppointmentForm({ initialData, onSubmit, onCancel }: { initialData?: Appointment, onSubmit: (data: Partial<Appointment>) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState({
    clientName: initialData?.clientName || '',
    clientPhone: initialData?.clientPhone || '',
    clientData: initialData?.clientData || '',
    time: initialData?.time ? format(parseISO(initialData.time), "yyyy-MM-dd'T'HH:mm") : '',
    course: initialData?.course || '',
  });

  const handleSave = () => {
    if (!formData.clientName.trim()) {
      toast.error('O nome do cliente é obrigatório');
      return;
    }
    if (!formData.time) {
      toast.error('O horário é obrigatório');
      return;
    }
    if (!formData.course.trim()) {
      toast.error('O curso é obrigatório');
      return;
    }

    try {
      const isoTime = new Date(formData.time).toISOString();
      onSubmit({ ...formData, time: isoTime });
    } catch (e) {
      toast.error('Data/Horário inválido');
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Cliente</Label>
        <Input id="name" value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} placeholder="Nome completo" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={formData.clientPhone} onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })} placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Horário</Label>
          <Input id="time" type="datetime-local" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="course">Curso Escolhido</Label>
        <Input id="course" value={formData.course} onChange={(e) => setFormData({ ...formData, course: e.target.value })} placeholder="Ex: Informática" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="data">Dados Adicionais</Label>
        <Textarea id="data" value={formData.clientData} onChange={(e) => setFormData({ ...formData, clientData: e.target.value })} placeholder="Outras informações importantes..." />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </div>
  );
}

function AppointmentCard({ app, onEdit, onDelete, onReschedule, onAction, actionLabel, showActions }: { 
  app: Appointment, 
  onEdit?: () => void, 
  onDelete?: () => void, 
  onReschedule?: () => void,
  onAction?: () => void,
  actionLabel?: string,
  showActions?: boolean,
  key?: string
}) {
  return (
    <Card className={`overflow-hidden border-l-4 ${getStatusColor(app.status)}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg leading-tight">{app.clientName}</h3>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" /> {format(parseISO(app.time), 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-400" /> {app.clientPhone}</p>
          <p className="flex items-center gap-2"><BookOpen className="h-3 w-3 text-slate-400" /> {app.course}</p>
        </div>

        {app.observations && (
          <div className="bg-slate-50 p-2 rounded text-xs italic text-slate-600 border">
            {app.observations}
          </div>
        )}

        <div className="pt-2 flex flex-wrap gap-2">
          {showActions && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="h-8 px-2"><Edit2 className="h-3 w-3 mr-1" /> Editar</Button>
              <Button variant="outline" size="sm" onClick={onReschedule} className="h-8 px-2"><CalendarIcon className="h-3 w-3 mr-1" /> Remarcar</Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
            </>
          )}
          {onAction && (
            <Button className="w-full" size="sm" onClick={onAction}>{actionLabel}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <Card className={`${colors[color]} border`}>
      <CardContent className="p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const styles: Record<AppointmentStatus, { label: string, variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pendente: { label: 'Pendente', variant: 'outline' },
    compareceu: { label: 'Compareceu', variant: 'secondary' },
    nao_compareceu: { label: 'Faltou', variant: 'destructive' },
    inscreveu: { label: 'Inscrito', variant: 'default' },
    nao_fechou_matricula: { label: 'Não Fechou', variant: 'outline' },
    matriculado: { label: 'Matriculado', variant: 'default' },
  };
  const config = styles[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getStatusColor(status: AppointmentStatus) {
  switch (status) {
    case 'compareceu': return 'border-l-green-500';
    case 'nao_compareceu': return 'border-l-red-500';
    case 'inscreveu': return 'border-l-blue-500';
    case 'nao_fechou_matricula': return 'border-l-orange-500';
    case 'matriculado': return 'border-l-purple-500';
    default: return 'border-l-slate-300';
  }
}
