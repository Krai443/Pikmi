import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = 'pikmi-1f69f';
const firebaseConfig = {
  apiKey: "AIzaSyDkGHRFyrf4ZbSvrjbdjQv3SpeSEwfeeqQ",
  authDomain: "pikmi-1f69f.firebaseapp.com",
  projectId: "pikmi-1f69f",
  storageBucket: "pikmi-1f69f.firebasestorage.app",
  messagingSenderId: "455117247242",
  appId: "1:455117247242:web:fdc896d5e38ba0af66e0f3"
};
const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
let currentUser = null;
let ordersUnsubscribe = null;
let currentOrdersList = [];

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    if (initialToken) {
        signInWithCustomToken(auth, initialToken)
            .then((userCred) => { currentUser = userCred.user; initApp(); })
            .catch(e => console.error("Auth Error:", e));
    } else {
        signInAnonymously(auth)
            .then((userCred) => { currentUser = userCred.user; initApp(); })
            .catch(e => console.error("Anon Auth Error:", e));
    }
} catch (error) {
    console.error("Firebase init failed", error);
}

const getOrdersCollection = () => collection(db, 'artifacts', appId, 'public', 'data', 'orders');

function initApp() {
    document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
    document.getElementById('editOrderForm').addEventListener('submit', handleEditOrderSubmit);
    listenToOrders();
}

/* --- UI Функції --- */
window.showToast = function(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

window.openOrderModal = function(itemName) {
    const selectElement = document.getElementById('orderItem');
    let optionExists = Array.from(selectElement.options).some(opt => opt.value === itemName);
    if (optionExists) {
        selectElement.value = itemName;
    } else {
        selectElement.value = "Будь-яка шаурма з меню";
    }
    
    document.getElementById('orderQuantity').value = 1;
    document.getElementById('orderModal').classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

window.closeOrderModal = function() {
    document.getElementById('orderModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('orderForm').reset();
}

window.openPasswordModal = function(event) {
    event.preventDefault();
    document.getElementById('passwordModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.closePasswordModal = function() {
    document.getElementById('passwordModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('passwordForm').reset();
}

document.getElementById('passwordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const pass = document.getElementById('adminPassword').value;
    if (pass === '1234') {
        closePasswordModal();
        toggleAdminPanel(true);
        showToast("Ви успішно увійшли!");
    } else {
        showToast("Невірний пароль!");
    }
});

window.toggleAdminPanel = function(showAdmin) {
    const mainSite = document.getElementById('main-site');
    const adminPanel = document.getElementById('admin-panel');
    
    if (showAdmin) {
        mainSite.style.display = 'none';
        adminPanel.style.display = 'block';
        window.scrollTo(0, 0);
    } else {
        mainSite.style.display = 'block';
        adminPanel.style.display = 'none';
    }
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

/* --- Firebase Логіка --- */
async function handleOrderSubmit(e) {
    e.preventDefault();
    if (!currentUser) return showToast("Зачекайте, з'єднання...");

    const formData = {
        item: document.getElementById('orderItem').value,
        quantity: parseInt(document.getElementById('orderQuantity').value) || 1,
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        address: document.getElementById('customerAddress').value,
        status: 'new',
        createdAt: Date.now()
    };

    try {
        await addDoc(getOrdersCollection(), formData);
        closeOrderModal();
        showToast("🎉 Ваше замовлення успішно прийнято!");
    } catch (error) {
        console.error("Помилка:", error);
        showToast("Сталася помилка. Спробуйте ще раз.");
    }
}

function listenToOrders() {
    if (!currentUser) return;
    if (ordersUnsubscribe) ordersUnsubscribe();

    ordersUnsubscribe = onSnapshot(getOrdersCollection(), (snapshot) => {
        const orders = [];
        snapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });

        orders.sort((a, b) => b.createdAt - a.createdAt);
        currentOrdersList = orders;
        renderOrdersTable(orders);
    }, (error) => {
        console.error("Помилка отримання даних:", error);
    });
}

window.openEditOrderModal = function(orderId) {
    const order = currentOrdersList.find(o => o.id === orderId);
    if (!order) return showToast("Замовлення не знайдено");

    document.getElementById('editOrderId').value = order.id;
    
    const selectItem = document.getElementById('editOrderItem');
    if(Array.from(selectItem.options).some(opt => opt.value === order.item)) {
        selectItem.value = order.item;
    }
    
    document.getElementById('editOrderQuantity').value = order.quantity || 1;
    document.getElementById('editOrderStatus').value = order.status || 'new';

    document.getElementById('editOrderModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

window.closeEditOrderModal = function() {
    document.getElementById('editOrderModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function handleEditOrderSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const orderId = document.getElementById('editOrderId').value;
    const updatedItem = document.getElementById('editOrderItem').value;
    const updatedQuantity = parseInt(document.getElementById('editOrderQuantity').value) || 1;
    const updatedStatus = document.getElementById('editOrderStatus').value;

    const orderDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', orderId);

    try {
        await updateDoc(orderDocRef, { 
            item: updatedItem,
            quantity: updatedQuantity,
            status: updatedStatus 
        });
        closeEditOrderModal();
        showToast("✅ Зміни успішно збережено!");
    } catch (error) {
        console.error("Помилка оновлення:", error);
        showToast("Помилка при збереженні.");
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = ''; 

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #888;">Поки що немає замовлень.</td></tr>';
        return;
    }

    orders.forEach(order => {
        const dateObj = new Date(order.createdAt);
        const dateStr = dateObj.toLocaleDateString('uk-UA') + '<br><small style="color:#888;">' + dateObj.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'}) + '</small>';
        
        let statusText = 'Нове';
        let statusClass = 'status-new';
        
        if (order.status === 'processing') {
            statusText = 'В процесі';
            statusClass = 'status-processing';
        } else if (order.status === 'done') {
            statusText = 'Виконано';
            statusClass = 'status-done';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><strong>${escapeHtml(order.name)}</strong></td>
            <td>
                <div style="white-space: nowrap;">${escapeHtml(order.phone)}</div>
                <div style="font-size:0.85rem; color:#666; max-width: 200px; white-space: normal;">${escapeHtml(order.address)}</div>
            </td>
            <td>
                <strong>${escapeHtml(order.item)}</strong><br>
                <span style="color:var(--dark-pink); font-weight:700;">x${order.quantity || 1} шт</span>
            </td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-small" onclick="openEditOrderModal('${order.id}')">Редагувати</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}