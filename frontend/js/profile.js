let newImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();
    
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                newImageFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('profileImagePreview').innerHTML = `<img src="${e.target.result}" class="w-100 h-100 object-fit-cover">`;
                };
                reader.readAsDataURL(newImageFile);
            }
        });
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('access_token');
            const saveBtn = document.getElementById('saveBtn');
            const statusMsg = document.getElementById('statusMsg');
            
            saveBtn.disabled = true;
            saveBtn.innerText = 'جاري الحفظ...';

            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('phone', document.getElementById('phone').value);
            formData.append('location', document.getElementById('location').value);
            if (newImageFile) {
                formData.append('image', newImageFile);
            }

            try {
                await api.auth.updateProfile(token, formData);
                statusMsg.className = 'text-success text-center fw-bold mt-2';
                statusMsg.innerText = 'تم حفظ التعديلات بنجاح!';
                statusMsg.classList.remove('d-none');
            } catch (error) {
                statusMsg.className = 'text-danger text-center fw-bold mt-2';
                statusMsg.innerText = 'خطأ: ' + JSON.stringify(error);
                statusMsg.classList.remove('d-none');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = 'حفظ التعديلات';
                setTimeout(() => statusMsg.classList.add('d-none'), 5000);
            }
        });
    }
});

async function fetchProfile() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '../auth/login.html';
        return;
    }

    try {
        const data = await api.auth.getProfile(token);
        
        document.getElementById('name').value = data.name || '';
        document.getElementById('phone').value = data.phone || '';
        document.getElementById('location').value = data.location || '';
        
        const roleMap = {
            'CUSTOMER': 'مشتري',
            'SHOP_OWNER': 'صاحب محل',
            'DRIVER': 'طيار (مندوب توصيل)',
            'ADMIN': 'مدير'
        };
        document.getElementById('role').value = roleMap[data.role] || data.role;

        if (data.image) {
            document.getElementById('profileImagePreview').innerHTML = `<img src="${data.image}" class="w-100 h-100 object-fit-cover">`;
        } else if (data.name) {
            document.getElementById('profileInitials').innerText = data.name.charAt(0);
        } else if (data.phone) {
            document.getElementById('profileInitials').innerText = data.phone.charAt(0);
        }
    } catch (error) {
        if (error.message === 'Unauthorized') {
            localStorage.removeItem('access_token');
            window.location.href = '../auth/login.html';
        } else {
            console.error("Failed to fetch profile:", error);
        }
    }
}
