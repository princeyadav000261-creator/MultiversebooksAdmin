import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =======================
// UI & NAVIGATION LOGIC
// =======================
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleMenu() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
}

menuToggle.addEventListener('click', toggleMenu);
sidebarOverlay.addEventListener('click', toggleMenu);

window.switchTab = function(tab) {
    document.querySelectorAll('.section-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    if(tab === 'add') {
        document.getElementById('sectionAddBook').classList.add('active');
        document.getElementById('navAddBook').classList.add('active');
        document.getElementById('topbarTitle').innerText = "Add New Book";
    } else if (tab === 'manage') {
        document.getElementById('sectionManageBooks').classList.add('active');
        document.getElementById('navManageBooks').classList.add('active');
        document.getElementById('topbarTitle').innerText = "Manage Vault";
    } else if (tab === 'analytics') {
        document.getElementById('sectionAnalytics').classList.add('active');
        document.getElementById('navAnalytics').classList.add('active');
        document.getElementById('topbarTitle').innerText = "System Logs";
    }
    
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    toastMsg.innerText = message;
    
    if(message.includes("Deleted")) {
        toast.style.background = "#ef4444";
        toast.style.color = "#fff";
    } else if (message.includes("Updated") || message.includes("Restored")) {
        toast.style.background = "#3b82f6";
        toast.style.color = "#fff";
    } else {
        toast.style.background = "#10b981";
        toast.style.color = "#fff";
    }
    
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

window.closeEditModal = function() { document.getElementById('editModal').classList.remove('active'); }

// =======================
// FIREBASE CONFIGURATION
// =======================
const firebaseConfig = {
    apiKey: "AIzaSyAXBSGCZFdkSbk-Ireoo7sRY4mLzS25nyk", // <-- Yahan warning ayegi Github se
    authDomain: "multiverse-books-2.firebaseapp.com",
    projectId: "multiverse-books-2",
    storageBucket: "multiverse-books-2.firebasestorage.app",
    messagingSenderId: "59280260709",
    appId: "1:59280260709:web:ef05fbe489ce2ee41e108c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CURRENT_ADMIN = "MADxPRINCE"; 

let dbBooks = [];
let dbLogs = [];

// =======================
// FIREBASE REAL-TIME FETCH
// =======================
const qBooks = query(collection(db, "books"), orderBy("createdAt", "desc"));
onSnapshot(qBooks, (snapshot) => {
    dbBooks = [];
    snapshot.forEach((doc) => {
        let data = doc.data();
        data.id = doc.id; 
        dbBooks.push(data);
    });
    renderBooks();
});

const qLogs = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"));
onSnapshot(qLogs, (snapshot) => {
    dbLogs = [];
    snapshot.forEach((doc) => {
        let logData = doc.data();
        logData.id = doc.id;
        dbLogs.push(logData);
    });
    renderLogs();
});

// =======================
// CRUD OPERATIONS
// =======================

async function logActivity(actionType, bookTitle, imageUrl = "", deletedBookData = null) {
    try {
        await addDoc(collection(db, "activity_logs"), {
            action: actionType,
            bookTitle: bookTitle,
            image: imageUrl,
            deletedData: deletedBookData, 
            adminName: CURRENT_ADMIN,
            timestamp: new Date().getTime(),
            dateStr: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })
        });
    } catch(e) {
        console.error("Failed to save log", e);
    }
}

document.getElementById('addBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
    
    const titleInput = document.getElementById('inTitle').value;
    const imgInput = document.getElementById('inImage').value;

    const newBook = {
        title: titleInput,
        author: document.getElementById('inAuthor').value,
        image: imgInput,
        year: document.getElementById('inYear').value,
        lang: document.getElementById('inLang').value,
        exams: document.getElementById('inExams').value,
        pdfLink: document.getElementById('inPdfUrl').value,
        ytLink: document.getElementById('inYtUrl').value,
        dateAdded: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
        createdAt: new Date().getTime()
    };

    try {
        await addDoc(collection(db, "books"), newBook);
        await logActivity("ADD", titleInput, imgInput); 
        showToast("Book Published Successfully!");
        e.target.reset(); 
    } catch (error) {
        alert("Error saving to database.");
    }
    btn.innerHTML = `<i class="fas fa-cloud-upload-alt"></i> Publish Book to Database`;
});

function renderBooks() {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = '';
    if (dbBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No records found. The vault is currently empty.</td></tr>`;
        return;
    }
    dbBooks.forEach((book, index) => {
        const safeTitle = book.title.replace(/'/g, "\\'"); 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${book.image}" class="table-img" onerror="this.src='https://via.placeholder.com/50x70?text=No+Img'"></td>
            <td>
                <strong style="color:#fff; display:block; margin-bottom:6px; font-size:1.1rem; letter-spacing:0.5px;">${book.title}</strong>
                <span style="font-size: 0.85rem; color: #a1a1aa;"><i class="fas fa-pen-nib" style="margin-right:5px;"></i> ${book.author} &nbsp;|&nbsp; <i class="far fa-calendar-alt" style="margin-right:5px;"></i> ${book.year}</span>
            </td>
            <td>
                <div style="font-size:0.9rem; color:#d4d4d8; margin-bottom:6px;">${book.exams}</div>
                <span style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color:#fff; padding:4px 10px; border-radius:8px; font-size:0.8rem;">${book.lang}</span>
            </td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal(${index})" title="Edit Record"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteBook('${book.id}', '${safeTitle}')" title="Delete Record"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteBook = async function(id, title) {
    if(confirm(`Are you sure you want to delete "${title}" permanently?`)) {
        const bookToDelete = dbBooks.find(b => b.id === id); 
        try {
            await deleteDoc(doc(db, "books", id));
            await logActivity("DELETE", title, bookToDelete.image, bookToDelete); 
            showToast("Record Deleted!");
        } catch (error) {
            console.error("Error deleting document: ", error);
        }
    }
}

window.openEditModal = function(index) {
    const book = dbBooks[index];
    document.getElementById('editDocId').value = book.id;
    document.getElementById('edTitle').value = book.title;
    document.getElementById('edAuthor').value = book.author;
    document.getElementById('edYear').value = book.year;
    document.getElementById('edLang').value = book.lang;
    document.getElementById('edExams').value = book.exams;
    document.getElementById('edImage').value = book.image;
    document.getElementById('edPdfUrl').value = book.pdfLink;
    document.getElementById('edYtUrl').value = book.ytLink || "";
    document.getElementById('editModal').classList.add('active');
}

document.getElementById('editBookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

    const docId = document.getElementById('editDocId').value;
    const updatedTitle = document.getElementById('edTitle').value;
    const updatedImage = document.getElementById('edImage').value;
    
    const updatedData = {
        title: updatedTitle,
        author: document.getElementById('edAuthor').value,
        image: updatedImage,
        year: document.getElementById('edYear').value,
        lang: document.getElementById('edLang').value,
        exams: document.getElementById('edExams').value,
        pdfLink: document.getElementById('edPdfUrl').value,
        ytLink: document.getElementById('edYtUrl').value
    };

    try {
        await updateDoc(doc(db, "books", docId), updatedData);
        await logActivity("EDIT", updatedTitle, updatedImage); 
        closeEditModal();
        showToast("Vault Record Updated!");
    } catch (error) {
        console.error("Error updating document: ", error);
    }
    btn.innerHTML = `<i class="fas fa-save"></i> Save Changes`;
});

window.restoreBook = async function(logId) {
    const logEntry = dbLogs.find(l => l.id === logId);
    if(!logEntry || !logEntry.deletedData) return;

    if(confirm(`Do you want to Recover/Restore "${logEntry.bookTitle}" to the main Vault?`)) {
        try {
            const restoredData = { ...logEntry.deletedData };
            delete restoredData.id; 
            restoredData.createdAt = new Date().getTime(); 

            await addDoc(collection(db, "books"), restoredData);
            await logActivity("RESTORE", logEntry.bookTitle, logEntry.image);
            showToast("Book Restored Successfully!");
        } catch(error) {
            console.error("Error restoring book: ", error);
        }
    }
}

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    tbody.innerHTML = '';
    
    if (dbLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No activity tracked yet. Logs will appear here.</td></tr>`;
        return;
    }

    dbLogs.forEach(log => {
        let badgeHTML = '';
        let recoveryHTML = '';
        
        if(log.action === 'ADD') {
            badgeHTML = `<span class="log-badge log-add"><i class="fas fa-plus"></i> Uploaded</span>`;
        } else if(log.action === 'EDIT') {
            badgeHTML = `<span class="log-badge log-edit"><i class="fas fa-pen"></i> Modified</span>`;
        } else if(log.action === 'DELETE') {
            badgeHTML = `<span class="log-badge log-delete"><i class="fas fa-trash"></i> Deleted</span>`;
            if(log.deletedData) {
                recoveryHTML = `<br><button class="action-btn btn-recover" onclick="restoreBook('${log.id}')"><i class="fas fa-undo"></i> Recover Book</button>`;
            }
        } else if (log.action === 'RESTORE') {
            badgeHTML = `<span class="log-badge log-restore"><i class="fas fa-trash-restore"></i> Restored</span>`;
        }

        let imageElement = log.image ? `<img src="${log.image}" class="log-table-img" onerror="this.src='https://via.placeholder.com/40x55?text=Img'">` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${badgeHTML}</td>
            <td style="display: flex; align-items: center;">
                ${imageElement}
                <span style="color:#fff; font-weight: 500; font-size:1.05rem;">${log.bookTitle}</span>
            </td>
            <td>
                <div class="log-admin-name">
                    <img src="https://i.postimg.cc/D0BF1b77/file-000000000e847207a64f6711d825a859.png" class="log-admin-avatar">
                    ${log.adminName}
                </div>
            </td>
            <td>
                <div style="color: #a1a1aa; font-size: 0.9rem;">
                    <i class="far fa-clock" style="margin-right:5px;"></i> ${log.dateStr}
                </div>
                ${recoveryHTML}
            </td>
        `;
        tbody.appendChild(tr);
    });
}
