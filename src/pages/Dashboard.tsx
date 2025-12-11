import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogOut, Save, Loader2, RefreshCw, User, Phone, Tag, FileText, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserData {
  email: string;
  tel: string;
  topic: string;
  keyword: string;
  title: string;
  igLink: string;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    tel: '',
    topic: '',
    keyword: '',
    title: '',
    igLink: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.email) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user?.email || !user?.id) return;
    
    setLoading(true);
    try {
      // First check if user has data in database
      const { data: dbData, error: dbError } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (dbError) throw dbError;

      // If database has data with content, use it
      if (dbData && (dbData.tel || dbData.topic || dbData.keyword || dbData.title || dbData.ig_link)) {
        setUserData({
          email: dbData.email,
          tel: dbData.tel || '',
          topic: dbData.topic || '',
          keyword: dbData.keyword || '',
          title: dbData.title || '',
          igLink: dbData.ig_link || '',
        });
        setFormData({
          tel: dbData.tel || '',
          topic: dbData.topic || '',
          keyword: dbData.keyword || '',
          title: dbData.title || '',
          igLink: dbData.ig_link || '',
        });
      } else {
        // Otherwise fetch from Google Sheets
        const { data, error } = await supabase.functions.invoke('google-sheets', {
          body: {
            action: 'read',
            email: user.email,
          },
        });

        if (error) throw error;

        if (data.found && data.userData) {
          setUserData(data.userData);
          setFormData({
            tel: data.userData.tel || '',
            topic: data.userData.topic || '',
            keyword: data.userData.keyword || '',
            title: data.userData.title || '',
            igLink: data.userData.igLink || '',
          });
        } else {
          // Create empty user data for new users
          setUserData({
            email: user.email,
            tel: '',
            topic: '',
            keyword: '',
            title: '',
            igLink: '',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('獲取資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !user?.email) return;

    setSaving(true);
    try {
      // Save to database
      const { error } = await supabase
        .from('members')
        .update({
          tel: formData.tel,
          topic: formData.topic,
          keyword: formData.keyword,
          title: formData.title,
          ig_link: formData.igLink,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Also sync to Google Sheets
      const { data: sheetResult, error: sheetError } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'update',
          email: user.email,
          data: formData,
        },
      });

      if (sheetError) {
        console.error('Google Sheets sync error:', sheetError);
        toast.warning('已儲存到資料庫，但 Google Sheet 同步失敗');
      } else if (sheetResult?.success) {
        toast.success('資料已儲存並同步到 Google Sheet！');
      } else {
        toast.warning('已儲存到資料庫，但 Google Sheet 同步失敗');
      }
      
      // Update local state
      setUserData(prev => prev ? {
        ...prev,
        tel: formData.tel,
        topic: formData.topic,
        keyword: formData.keyword,
        title: formData.title,
        igLink: formData.igLink,
      } : null);
    } catch (err) {
      console.error('Error saving data:', err);
      toast.error('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-subtle">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-foreground">會員數據管理</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
            登出
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-slide-up">
          <Card className="shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="font-display text-xl">我的資料</CardTitle>
                <CardDescription>查看和編輯您的資料</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchUserData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !userData ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">
                    找不到您的資料
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      電郵 (不可修改)
                    </Label>
                    <Input
                      value={userData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* Tel */}
                  <div className="space-y-2">
                    <Label htmlFor="tel" className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      電話
                    </Label>
                    <Input
                      id="tel"
                      value={formData.tel}
                      onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                      placeholder="輸入電話號碼"
                    />
                  </div>

                  {/* Topic */}
                  <div className="space-y-2">
                    <Label htmlFor="topic" className="text-sm font-medium flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      主題
                    </Label>
                    <Input
                      id="topic"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      placeholder="輸入主題"
                    />
                  </div>

                  {/* Keyword */}
                  <div className="space-y-2">
                    <Label htmlFor="keyword" className="text-sm font-medium flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      關鍵字
                    </Label>
                    <Input
                      id="keyword"
                      value={formData.keyword}
                      onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                      placeholder="輸入關鍵字"
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      標題
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="輸入標題"
                    />
                  </div>

                  {/* IG Link */}
                  <div className="space-y-2">
                    <Label htmlFor="igLink" className="text-sm font-medium flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                      IG 連結
                    </Label>
                    <Input
                      id="igLink"
                      value={formData.igLink}
                      onChange={(e) => setFormData({ ...formData, igLink: e.target.value })}
                      placeholder="輸入 IG 連結"
                    />
                  </div>

                  {/* Save Button */}
                  <Button
                    variant="gradient"
                    className="w-full"
                    size="lg"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        儲存變更
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
