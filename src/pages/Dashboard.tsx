import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogOut, Loader2, RefreshCw, User, Phone, Tag, FileText, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface UserData {
  email: string;
  tel: string;
  topic: string;
  keyword: string;
  title: string;
  igLink: string;
  rowIndex: number;
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-sheets', {
        body: {
          action: 'read',
          email: user.email,
        },
      });

      if (error) throw error;

      if (data.found && data.userData) {
        setUserData(data.userData);
      } else {
        setUserData(null);
        toast.info('在表格中找不到您的資料');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error('獲取資料失敗');
    } finally {
      setLoading(false);
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
                <CardDescription>查看您在 Google Sheet 中的資料</CardDescription>
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
                    在表格中找不到您的電郵地址
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    請確認您使用的電郵與表格中的一致
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      電郵
                    </Label>
                    <Input
                      value={userData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* Tel */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      電話
                    </Label>
                    <Input
                      value={userData.tel}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* Topic */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      主題
                    </Label>
                    <Input
                      value={userData.topic}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* Keyword */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      關鍵字
                    </Label>
                    <Input
                      value={userData.keyword}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      標題
                    </Label>
                    <Input
                      value={userData.title}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  {/* IG Link */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                      IG 連結
                    </Label>
                    <Input
                      value={userData.igLink}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <p className="text-sm text-muted-foreground text-center pt-4">
                    如需編輯資料，請直接在 Google Sheet 中修改
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
