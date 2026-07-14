import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { compressProfilePhotoFile, formatBytes } from '../../lib/image-compress';
import { isCustomProfilePhoto } from '../../lib/users';
import { Button } from '../ui/Button';
import { UserAvatar } from '../ui/UserAvatar';

export function ProfilePhotoEditor() {
  const { profile, updateProfilePhoto } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!profile) return null;

  const hasCustomPhoto = isCustomProfilePhoto(profile.photoURL);

  const handlePick = () => {
    setError('');
    setSuccess('');
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const { dataUrl, sizeBytes } = await compressProfilePhotoFile(file);
      await updateProfilePhoto(dataUrl);
      setSuccess(`Photo updated · compressed to ${formatBytes(sizeBytes)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      await updateProfilePhoto(null);
      setSuccess('Profile photo removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove profile photo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-photo-editor">
      <div className="profile-photo-preview-wrap">
        <UserAvatar user={profile} size="xl" className="profile-photo-preview" />
        <button
          type="button"
          className="profile-photo-camera-btn"
          onClick={handlePick}
          disabled={uploading}
          aria-label="Change profile photo"
        >
          <Camera size={16} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="profile-photo-input"
        onChange={handleFileChange}
      />

      <div className="profile-photo-actions">
        <Button variant="secondary" size="sm" onClick={handlePick} disabled={uploading}>
          {uploading ? 'Processing...' : 'Upload photo'}
        </Button>
        {hasCustomPhoto && (
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={uploading}>
            <Trash2 size={15} />
            Remove
          </Button>
        )}
      </div>

      <p className="profile-photo-hint">
        JPG, PNG, WebP, or GIF. Automatically compressed to 50 KB or less.
      </p>
      {error && <p className="form-error">{error}</p>}
      {success && <p className="profile-photo-success">{success}</p>}
    </div>
  );
}
