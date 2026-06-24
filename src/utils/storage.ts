import { supabase } from '../lib/supabase';

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const filePath = `${userId}/${Date.now()}.jpg`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: filePath,
    } as any);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, formData, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    return publicUrl;
  } catch (error: any) {
    console.error('Erro ao enviar avatar:', error.message);
    return null;
  }
}
