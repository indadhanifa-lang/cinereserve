import { useCallback, useEffect, useRef, useState } from 'react';
import { IonContent, IonIcon, IonPage, IonSpinner, useIonRouter } from '@ionic/react';
import { arrowBackOutline, cameraOutline, saveOutline, personOutline, mailOutline, callOutline } from 'ionicons/icons';
import { navigate } from '../lib/nav';
import { apiGetAuth, apiPatchAuth, apiUploadAuth, resolveStorageUrl } from '../lib/api';
import './PersonalInformation.css';

interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
}

interface ProfileResponse {
  user: CustomerProfile;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i;

const readAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const apiError = error as { message?: string; errors?: Record<string, string[]> };
    const firstError = apiError.errors ? Object.values(apiError.errors)[0] : undefined;
    if (firstError && firstError[0]) return firstError[0];
    if (apiError.message) return apiError.message;
  }
  return fallback;
};

const PersonalInformation: React.FC = () => {
  const ionRouter = useIonRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState({ name: '', email: '', phone: '' });

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastTitle, setToastTitle] = useState('');
  const [toastSubtitle, setToastSubtitle] = useState('');

  const showToastMessage = useCallback((title: string, subtitle: string) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2800);
  }, []);

  const applyProfile = useCallback((user: CustomerProfile) => {
    const nextPhone = user.phone ?? '';
    setFullName(user.name);
    setEmail(user.email);
    setPhone(nextPhone);
    setSavedSnapshot({ name: user.name, email: user.email, phone: nextPhone });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        const data = await apiGetAuth<ProfileResponse>('/customer/me');
        if (cancelled) return;
        applyProfile(data.user);
        setAvatarSrc(resolveStorageUrl(data.user.avatar_url));
      } catch (error) {
        if (cancelled) return;
        showToastMessage('Unable to load profile', getErrorMessage(error, 'Please try again later.'));
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [applyProfile, showToastMessage]);

  const triggerAvatarUpload = () => {
    if (uploadingAvatar) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file || uploadingAvatar) return;

    const hasAllowedType = ALLOWED_IMAGE_TYPES.includes(file.type)
      || (!file.type && ALLOWED_IMAGE_EXTENSION.test(file.name));

    if (!hasAllowedType) {
      showToastMessage('Unsupported Format', 'Choose a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      showToastMessage('Image Too Large', 'Maximum avatar file size is 5 MB.');
      return;
    }

    const previousAvatar = avatarSrc;
    setUploadingAvatar(true);

    try {
      const preview = await readAsDataURL(file);
      setAvatarSrc(preview);

      const formData = new FormData();
      formData.append('avatar', file);

      const data = await apiUploadAuth<ProfileResponse>('/customer/avatar', formData);
      setAvatarSrc(resolveStorageUrl(data.user.avatar_url));
      showToastMessage('Photo Updated', 'Your profile picture has been updated.');
    } catch (error) {
      setAvatarSrc(previousAvatar);
      showToastMessage('Upload Failed', getErrorMessage(error, 'Unable to upload photo. Please try again.'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (saving || loadingProfile) return;
    setSaving(true);

    try {
      const data = await apiPatchAuth<ProfileResponse>('/customer/profile', {
        name: fullName,
        email,
        phone,
      });

      applyProfile(data.user);
      setSaved(true);
      showToastMessage('Profile updated successfully.', 'Your CineReserve account details are up to date.');

      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      showToastMessage('Save Failed', getErrorMessage(error, 'Unable to update profile. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(savedSnapshot.name);
    setEmail(savedSnapshot.email);
    setPhone(savedSnapshot.phone);
    navigate(ionRouter, '/profile');
  };

  const fieldDisabled = loadingProfile || saving;

  return (
    <IonPage>
      <div className="pi-page">
        <header className="pi-header">
          <button
            type="button"
            className="pi-header__back"
            onClick={() => navigate(ionRouter, '/profile')}
            aria-label="Go back"
          >
            <IonIcon icon={arrowBackOutline} />
          </button>
          <h1 className="pi-header__title">Personal Information</h1>
          <div className="pi-header__spacer" />
        </header>

        <IonContent scrollY className="pi-content">
          <div className="pi-body">
            <div className="pi-glow" aria-hidden="true" />

            <div className="pi-avatar-section">
              <div className="pi-avatar-wrap">
                <div className="pi-avatar-ring">
                  {loadingProfile ? (
                    <span className="pi-avatar-loading">
                      <IonSpinner name="crescent" />
                    </span>
                  ) : avatarSrc ? (
                    <img
                      alt="Profile avatar"
                      className="pi-avatar-img"
                      src={avatarSrc}
                    />
                  ) : (
                    <span className="pi-avatar-initials">{getInitials(fullName)}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="pi-avatar-camera"
                  onClick={triggerAvatarUpload}
                  disabled={uploadingAvatar}
                  aria-label="Change profile photo"
                >
                  {uploadingAvatar ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    <IonIcon icon={cameraOutline} />
                  )}
                </button>
              </div>
              {loadingProfile ? (
                <IonSpinner name="dots" className="pi-profile-spinner" />
              ) : (
                <>
                  <h2 className="pi-display-name">{fullName}</h2>
                  <p className="pi-display-email">{email}</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpg,image/jpeg,image/png,image/webp"
                className="pi-file-input"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="pi-form">
              <div className="pi-form-card">
                <div className="pi-field">
                  <label className="pi-field__label" htmlFor="input-fullname">
                    <IonIcon icon={personOutline} className="pi-field__label-icon" />
                    Full Name
                  </label>
                  <div className="pi-field__input-wrap">
                    <input
                      id="input-fullname"
                      type="text"
                      className="pi-field__input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={fieldDisabled}
                    />
                  </div>
                </div>

                <div className="pi-field">
                  <label className="pi-field__label" htmlFor="input-email">
                    <IonIcon icon={mailOutline} className="pi-field__label-icon" />
                    Email Address
                  </label>
                  <div className="pi-field__input-wrap">
                    <input
                      id="input-email"
                      type="email"
                      className="pi-field__input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={fieldDisabled}
                    />
                  </div>
                </div>

                <div className="pi-field">
                  <label className="pi-field__label" htmlFor="input-phone">
                    <IonIcon icon={callOutline} className="pi-field__label-icon" />
                    Mobile Number
                  </label>
                  <div className="pi-field__input-wrap">
                    <input
                      id="input-phone"
                      type="tel"
                      className="pi-field__input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={fieldDisabled}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pi-actions">
              <button
                type="button"
                className={`pi-save-btn ${saving ? 'pi-save-btn--saving' : ''} ${saved ? 'pi-save-btn--saved' : ''}`}
                onClick={handleSave}
                disabled={fieldDisabled}
              >
                {saving ? (
                  <IonSpinner name="circles" className="pi-save-btn__spinner" />
                ) : (
                  <IonIcon icon={saveOutline} className="pi-save-btn__icon" />
                )}
                <span>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
              </button>
              <button
                type="button"
                className="pi-cancel-btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        </IonContent>

        <div className={`pi-toast ${showToast ? 'pi-toast--visible' : ''}`}>
          <div className="pi-toast__icon">
            <IonIcon icon={saveOutline} />
          </div>
          <div className="pi-toast__text">
            <span className="pi-toast__title">{toastTitle}</span>
            <span className="pi-toast__subtitle">{toastSubtitle}</span>
          </div>
        </div>
      </div>
    </IonPage>
  );
};

export default PersonalInformation;
