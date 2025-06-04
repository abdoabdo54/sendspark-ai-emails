import sys
import os
import json
import re
import string
import uuid
from datetime import datetime
import csv
import io
import itertools
import urllib.parse
import random
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import queue
from email.utils import formataddr, parseaddr
from collections import defaultdict

import requests
import html2text

# Try to import pandas for Excel functionality
PANDAS_AVAILABLE = False
PANDAS_IMPORT_ERROR = ""
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError as e:
    PANDAS_IMPORT_ERROR = f"Pandas library not found (pip install pandas openpyxl). Excel import functionality will be disabled."
    print(PANDAS_IMPORT_ERROR)

# Try to import Google Generative AI
GEMINI_API_AVAILABLE = False
GEMINI_IMPORT_ERROR = ""
try:
    import google.generativeai as genai
    GEMINI_API_AVAILABLE = True
except ImportError as e:
    GEMINI_IMPORT_ERROR = f"Google Generative AI library not found (pip install google-generativeai). AI features disabled. Error: {e}"
    print(GEMINI_IMPORT_ERROR)

# PyQt5 Imports
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QTextEdit, QPushButton, QFileDialog,
    QListWidget, QListWidgetItem, QMessageBox, QStatusBar, QFormLayout, QGroupBox,
    QToolBar, QAction, QColorDialog, QFontDialog, QComboBox, QProgressBar, QTabWidget,
    QDialog, QDialogButtonBox, QAbstractItemView, QMenu, QStackedWidget, QSpinBox,
    QSizePolicy, QCheckBox, QDoubleSpinBox, QSplitter, QScrollArea, QHeaderView, QTreeWidgetItem, QTreeWidget
)

from PyQt5.QtGui import (
    QIcon, QColor, QTextCharFormat, QFont, QTextBlockFormat, QTextCursor, QKeySequence,
    QFontDatabase, QTextListFormat, QIntValidator, QDesktopServices, QDoubleValidator
)
from PyQt5.QtCore import (
    QThread, pyqtSignal, Qt, QSettings, QSize, QDir, QStandardPaths, QTimer, QFileInfo,
    QUrl, QByteArray, pyqtSlot, QMutex, QWaitCondition
)

# --- Robust Handling for Optional WebEngine/Network Components ---
WEBENGINE_AVAILABLE = False
WEBENGINE_IMPORT_ERROR = "PyQtWebEngine/QtNetwork components not loaded by default."

# Define Dummy classes first
class _DummyQWebEngineView(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.label = QLabel(WEBENGINE_IMPORT_ERROR, self)
        self.label.setAlignment(Qt.AlignCenter)
        self.label.setWordWrap(True)
        layout = QVBoxLayout(self)
        layout.addWidget(self.label)
        layout.setContentsMargins(10,10,10,10)
    def setUrl(self, url): self.label.setText(f"WebEngine Disabled (cannot load URL).\n{WEBENGINE_IMPORT_ERROR}")
    def reload(self): pass
    def page(self): return None
    def setPage(self, page): pass
    def setHtml(self, html, baseUrl=None): self.label.setText(f"WebEngine Disabled (cannot set HTML).\n{WEBENGINE_IMPORT_ERROR}")

class _DummyQWebEngineProfile:
    def __init__(self, parent=None): pass

class _DummyQAuthenticator:
    def __init__(self): pass
    def setUser(self, user): pass
    def setPassword(self, password): pass

class _DummyQWebEnginePage:
    authenticationRequired = pyqtSignal(QUrl, _DummyQAuthenticator)
    def __init__(self, profile, parent=None): pass

class _DummyQNetworkProxy:
    NoProxy, HttpProxy, Socks5Proxy = 0, 1, 2
    def __init__(self, proxy_type=None, hostName=None, port=0, user="", password=""): pass
    def setType(self, type): pass
    def setHostName(self, hostName): pass
    def setPort(self, port): pass
    def setUser(self, user): pass
    def setPassword(self, password): pass
    @staticmethod
    def setApplicationProxy(proxy): pass

# Assign dummies as the default
QWebEngineView = _DummyQWebEngineView
QWebEngineProfile = _DummyQWebEngineProfile
QWebEnginePage = _DummyQWebEnginePage
QAuthenticator = _DummyQAuthenticator
QNetworkProxy = _DummyQNetworkProxy

# Try to import the real components
try:
    from PyQt5.QtWebEngineWidgets import QWebEngineView as RealQWebEngineView, \
                                         QWebEngineProfile as RealQWebEngineProfile, \
                                         QWebEnginePage as RealQWebEnginePage
    from PyQt5.QtNetwork import QAuthenticator as RealQAuthenticator, \
                                QNetworkProxy as RealQNetworkProxy

    QWebEngineView = RealQWebEngineView
    QWebEngineProfile = RealQWebEngineProfile
    QWebEnginePage = RealQWebEnginePage
    QAuthenticator = RealQAuthenticator
    QNetworkProxy = RealQNetworkProxy

    WEBENGINE_AVAILABLE = True
    WEBENGINE_IMPORT_ERROR = ""
    print("Successfully imported PyQtWebEngine and QtNetwork components.")

except ImportError as e:
    WEBENGINE_IMPORT_ERROR = f"PyQtWebEngine or QtNetwork not found (pip install PyQtWebEngine). PMTA dashboard embedding and WebEngine proxy disabled. Error: {e}"
    print(WEBENGINE_IMPORT_ERROR)

# --- Constants ---
CONFIG_DIR_NAME_BASE = "GmailMailerPyQtAdvanced"
APP_VERSION_SUFFIX = "_Senders_V2_SpeedOptimized_Upgraded" # Updated version suffix

# Determine the directory of the script
if getattr(sys, 'frozen', False):
    SCRIPT_DIR = os.path.dirname(sys.executable)
else:
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

CONFIG_DIR_PATH_BASE = os.path.join(SCRIPT_DIR, CONFIG_DIR_NAME_BASE + APP_VERSION_SUFFIX)
ALL_SENDER_ACCOUNTS_FILE_NAME = ".all_sender_accounts.json"
ALL_SENDER_ACCOUNTS_FILE_PATH = os.path.join(CONFIG_DIR_PATH_BASE, ALL_SENDER_ACCOUNTS_FILE_NAME)

# Performance constants
PROGRESS_PREPARING_REQUEST = 20
PROGRESS_SENDING_REQUEST = 50
PROGRESS_AWAITING_RESPONSE = 70
PROGRESS_PROCESSING_RESPONSE = 90
PROGRESS_DONE = 100

# Settings keys
GEMINI_API_KEY_SETTING = "gemini_api_key"
MAX_CONCURRENT_SENDS_SETTING = "max_concurrent_sends"
SEND_VIA_SETTING = "send_via_method"
PROXY_ENABLED_SETTING = "proxy_enabled"
PROXY_TYPE_SETTING = "proxy_type"
PROXY_HOST_SETTING = "proxy_host"
PROXY_PORT_SETTING = "proxy_port"
PROXY_USER_SETTING = "proxy_user"
PROXY_PASS_SETTING = "proxy_pass"
TEST_EMAIL_ADDRESS_SETTING = "test_email_address"
TEST_AFTER_X_EMAILS_SETTING = "test_after_x_emails"

# --- Advanced Rate Limiter with Burst Support ---
class AdvancedRateLimiter:
    def __init__(self, emails_per_second=1, burst_size=5):
        self.emails_per_second = max(emails_per_second, 0.1)  # Minimum rate
        self.burst_size = max(burst_size, 1)
        self.tokens = float(burst_size) # Use float for more precise token accumulation
        self.last_update = time.time()
        self.lock = threading.Lock()
    
    def acquire(self, timeout=30):
        """Acquire permission to send. Returns True if allowed, False if timeout."""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            with self.lock:
                now = time.time()
                # Add tokens based on time elapsed
                tokens_to_add = (now - self.last_update) * self.emails_per_second
                self.tokens = min(self.burst_size, self.tokens + tokens_to_add)
                self.last_update = now
                
                if self.tokens >= 1:
                    self.tokens -= 1
                    return True
            
            # Brief sleep to avoid busy waiting, slightly longer if tokens are low
            # to give more time for token replenishment.
            sleep_duration = 0.01 if self.tokens < 1 else 0.001
            time.sleep(sleep_duration)
        
        return False  # Timeout reached

# --- High-Performance Job Queue Manager ---
class HighPerformanceJobQueue:
    def __init__(self, max_workers=10):
        self.job_queue = queue.Queue()
        # self.result_queue = queue.Queue() # Not directly used by OptimizedEmailSenderThread in this version
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_futures = {}
        self.completed_jobs_count = 0 # Renamed for clarity
        self.total_jobs_submitted_to_q = 0 # Renamed for clarity
        self.lock = threading.Lock()
        self.is_running = False # Controls if new tasks are submitted from internal queue
        
    def add_job(self, job_data):
        """Add a job to the internal queue"""
        self.job_queue.put(job_data)
        with self.lock:
            self.total_jobs_submitted_to_q += 1
    
    def start_processing(self, worker_function, max_concurrent_tasks=5):
        """Start processing jobs with specified worker function and concurrency for this queue manager."""
        self.is_running = True
        
        # Submit initial batch of tasks to the executor
        for _ in range(min(max_concurrent_tasks, self.job_queue.qsize())):
            if not self.job_queue.empty() and self.is_running:
                try:
                    job = self.job_queue.get_nowait()
                    future = self.executor.submit(worker_function, job)
                    self.active_futures[future] = job
                except queue.Empty:
                    break # No more jobs in internal queue
                except RuntimeError: 
                    print("HighPerformanceJobQueue: Executor shutting down, cannot submit new job in start_processing.")
                    # Potentially put job back if it's critical to re-queue failed submissions
                    # self.job_queue.put(job) 
                    break
    
    def get_completed_jobs(self, worker_function):
        """Get completed jobs (non-blocking) and submit new ones if running."""
        completed_results = [] # Renamed for clarity
        
        done_futures_list = [] # Renamed
        # Iterate over a copy of keys if modifying the dict (though pop should be safe here)
        for future in list(self.active_futures.keys()):
            if future.done():
                done_futures_list.append(future)
        
        for future in done_futures_list:
            job_associated_with_future = self.active_futures.pop(future, None) 
            if job_associated_with_future is None: continue

            try:
                result_from_future = future.result()
                completed_results.append((job_associated_with_future, result_from_future, None))  # (job, result, error)
            except Exception as e:
                completed_results.append((job_associated_with_future, None, str(e)))
            
            with self.lock:
                self.completed_jobs_count += 1
            
            # Submit next job from internal queue if available AND if this queue manager is still supposed to be running
            if self.is_running and not self.job_queue.empty():
                try:
                    next_job_from_q = self.job_queue.get_nowait()
                    new_future = self.executor.submit(worker_function, next_job_from_q)
                    self.active_futures[new_future] = next_job_from_q
                except queue.Empty:
                    pass # No more jobs in internal queue
                except RuntimeError: 
                    print("HighPerformanceJobQueue: Executor shutting down, cannot submit new job in get_completed_jobs.")
                    if 'next_job_from_q' in locals(): self.job_queue.put(next_job_from_q) # Re-queue if submission failed
                    break 
        
        return completed_results
    
    def get_progress(self):
        """Get current progress: completed, active in executor, total submitted to this queue"""
        with self.lock:
            if self.total_jobs_submitted_to_q == 0:
                return 0, 0, 0
            return self.completed_jobs_count, len(self.active_futures), self.total_jobs_submitted_to_q
    
    def stop(self):
        """Stop processing: signal no new tasks, cancel pending, shutdown executor and wait."""
        print("HighPerformanceJobQueue: Stop called.")
        self.is_running = False # Signal internal loops to stop submitting new tasks
        
        print(f"HighPerformanceJobQueue: Cancelling {len(self.active_futures)} active/pending futures...")
        for future in list(self.active_futures.keys()): 
            if not future.done(): 
                if future.cancel(): # Returns True if successfully cancelled
                    print(f"HighPerformanceJobQueue: Future for job {self.active_futures.get(future, 'unknown_job_details')} cancelled.")
                # else: # False if already running or done, cannot be cancelled
                    # print(f"HighPerformanceJobQueue: Future for job {self.active_futures.get(future, 'unknown_job_details')} could not be cancelled (may be running/done).")
        
        # Shutdown the executor. `wait=True` ensures currently running tasks complete.
        print("HighPerformanceJobQueue: Shutting down executor (wait=True)...")
        self.executor.shutdown(wait=True) 
        print("HighPerformanceJobQueue: Executor shutdown complete.")
    
    def is_finished(self):
        """Check if all jobs submitted to this queue manager have been processed."""
        with self.lock:
            # Queue is finished if internal job_queue is empty, no futures are active in executor,
            # AND the count of completed jobs matches total jobs ever submitted to this queue.
            return (self.job_queue.empty() and 
                    len(self.active_futures) == 0 and 
                    self.completed_jobs_count >= self.total_jobs_submitted_to_q)


def send_email_via_apps_script(job_data):
    """Optimized Apps Script sender for a single email job."""
    start_time = time.time() 
    try:
        # ... (payload setup as before) ...
        payload = {
            "to": ", ".join(job_data['recipients_to_list']),
            "subject": job_data['subject']
        }
        
        if job_data.get('htmlBody'): payload["htmlBody"] = job_data['htmlBody']
        if job_data.get('plainBody'): payload["plainBody"] = job_data['plainBody']
        if job_data.get('custom_headers_dict'): payload["headers"] = job_data['custom_headers_dict']
        if job_data.get('sender_display_name'): payload["fromName"] = job_data['sender_display_name']
        
        session = requests.Session()
        if job_data.get('proxy_dict'):
            session.proxies.update(job_data['proxy_dict'])
        
        response = session.post(
            job_data['web_app_url'],
            json=payload,
            timeout=30, 
            headers={'Content-Type': 'application/json'}
        )
        
        response_text_for_error = response.text[:500] # Get more of the response for errors
        
        response.raise_for_status() 
        result = response.json()
        elapsed = time.time() - start_time
        
        if result.get("status") == "success":
            return {'success': True, 'message': f"AS Success: {result.get('message', '')}", 'elapsed': elapsed} # Shorter success
        else:
            # Include more details from the Apps Script response
            return {'success': False, 'message': f"AS Error: {result.get('message', 'Unknown error')}. Response: {result.get('details', response_text_for_error)}", 'elapsed': elapsed}
            
    except requests.exceptions.Timeout:
        return {'success': False, 'message': "AS Timeout", 'elapsed': time.time() - start_time}
    except requests.exceptions.HTTPError as e:
        err_msg = f"AS HTTP Error: {e.response.status_code}"
        try: # Try to get more details from response if possible
            err_details = e.response.json()
            err_msg += f" - {err_details.get('error', {}).get('message', e.response.text[:200])}"
        except ValueError: # Not JSON
            err_msg += f" - {e.response.text[:200]}"
        return {'success': False, 'message': err_msg, 'elapsed': time.time() - start_time}
    except requests.exceptions.RequestException as e:
        return {'success': False, 'message': f"AS Network Error: {type(e).__name__}", 'elapsed': time.time() - start_time}
    except Exception as e:
        import traceback
        print(f"UNEXPECTED ERROR in send_email_via_apps_script: {traceback.format_exc()}")
        return {'success': False, 'message': f"AS Exception: {type(e).__name__}", 'elapsed': time.time() - start_time}

def send_email_via_smtp(job_data):
    """Optimized SMTP sender for a single email job, incorporating rate limiting."""
    start_time = time.time()
    try:
        if 'rate_limiter' in job_data and job_data['rate_limiter']:
            if not job_data['rate_limiter'].acquire(timeout=15): 
                return {'success': False, 'message': "SMTP Rate Limit Timeout", 'elapsed': time.time() - start_time}
        
        msg = MIMEMultipart('alternative')
        
        from_header_value = job_data.get('from_address', 'default_sender@unknown.com')
        
        # --- CORRECTED PARSING of From Header ---
        # Use parseaddr (now directly available due to corrected import)
        parsed_from_name, parsed_from_email = parseaddr(from_header_value) # NO "email.utils." prefix
        
        actual_from_email_for_smtp = parsed_from_email
        if not actual_from_email_for_smtp: 
            actual_from_email_for_smtp = from_header_value

        # Use formataddr (also directly available)
        msg['From'] = formataddr((parsed_from_name, parsed_from_email)) if parsed_from_name else parsed_from_email

        msg['To'] = ", ".join(job_data['recipients_to_list'])
        msg['Subject'] = Header(job_data['subject'], 'utf-8')
        
        # ... (rest of the function remains the same as the previously corrected version) ...
        for key, value in job_data.get('all_custom_headers', {}).items():
            if key.lower() not in ['from', 'to', 'subject']:
                try:
                    msg[key] = Header(str(value), 'utf-8')
                except Exception as e_header:
                    print(f"Warning: Could not set custom header {key}: {value}. Error: {e_header}")
        
        if job_data.get('plainBody'): msg.attach(MIMEText(job_data['plainBody'], 'plain', 'utf-8'))
        if job_data.get('htmlBody'): msg.attach(MIMEText(job_data['htmlBody'], 'html', 'utf-8'))
        
        server = None
        try:
            smtp_connect_timeout = 25 
            if job_data.get('encryption', '').lower() == 'ssl':
                server = smtplib.SMTP_SSL(job_data['host'], job_data['port'], timeout=smtp_connect_timeout)
            else:
                server = smtplib.SMTP(job_data['host'], job_data['port'], timeout=smtp_connect_timeout)
                server.ehlo()
                if 'tls' in job_data.get('encryption', '').lower() or job_data.get('encryption', '').lower() == 'starttls':
                    server.starttls()
                    server.ehlo()
            
            if job_data.get('username') and job_data.get('password'):
                server.login(job_data['username'], job_data['password'])
            
            errors_dict = server.sendmail(actual_from_email_for_smtp, job_data['recipients_to_list'], msg.as_string())
            elapsed = time.time() - start_time

            if not errors_dict:
                return {'success': True, 'message': "SMTP Sent", 'elapsed': elapsed}
            else:
                error_summary = "; ".join([f"{email}: {code} {reason.decode(errors='ignore') if isinstance(reason, bytes) else reason}" for email, (code, reason) in errors_dict.items()])
                return {'success': False, 'message': f"SMTP Partial/Total Failure: {error_summary}", 'elapsed': elapsed}
            
        finally:
            if server:
                try: server.quit()
                except: pass 
    
    except smtplib.SMTPResponseException as e:
        error_detail = e.smtp_error.decode(errors='ignore') if isinstance(e.smtp_error, bytes) else str(e.smtp_error)
        return {'success': False, 'message': f"SMTP Error {e.smtp_code}: {error_detail}", 'elapsed': time.time() - start_time}
    except smtplib.SMTPException as e:
         return {'success': False, 'message': f"SMTP Error: {type(e).__name__} - {str(e)}", 'elapsed': time.time() - start_time}
    except Exception as e:
        import traceback
        print(f"UNEXPECTED ERROR in send_email_via_smtp: {traceback.format_exc()}")
        return {'success': False, 'message': f"SMTP Exception: {type(e).__name__}", 'elapsed': time.time() - start_time}


# --- Tag System Constants & Helpers ---
CHAR_SETS = {
    'n': string.digits,
    'l': string.ascii_lowercase,
    'u': string.ascii_uppercase,
    's': "!@#$%^&*()-_=+[]{};:'\",.<>/?~`|",
    'a': string.ascii_letters + string.digits,
    'lu': string.ascii_letters,
    'ln': string.ascii_lowercase + string.digits,
    'un': string.ascii_uppercase + string.digits,
}

def generate_random_string(length, char_set_key):
    chars_to_use = CHAR_SETS.get(char_set_key, CHAR_SETS['a'])
    if not chars_to_use: chars_to_use = CHAR_SETS['a'] # Fallback
    return ''.join(random.choice(chars_to_use) for _ in range(length))

USABLE_TAGS_STRUCTURE = {
    "Basic Info": {
        "{{[fromname]}}": "Randomly selected 'From Name' from the UI editor list (cycled per email if multiple defined). This tag is resolved to the *specific* From Name chosen for *this* email.",
        "{{[subject]}}": "Randomly selected 'Subject' from the UI editor list (cycled per email if multiple defined). This tag is resolved to the *specific* Subject chosen for *this* email.",
        "{{[to]}}": "Current recipient's email address (primary recipient for this job).",
        "{{[name]}}": "Username part of the current recipient's email (e.g., 'john.doe' from 'john.doe@example.com').",
        "{{[date]}}": "Current date and time (YYYY-MM-DD HH:MM:SS) at the moment of tag resolution.",
        "{{[ide]}}": "Unique ID generated for this specific email job (e.g., a short UUID).",
    },
    "SMTP Specific": {
        "{{[smtp]}}": "Username of the SMTP server being used for this email (if applicable).",
        "{{[smtp_name]}}": "Nickname of the SMTP server account being used for this email (if applicable).",
    },
    "Tracking & Utility Tags": {
        "{{[tag]}}": "A short (8-character) random alphanumeric string, generated fresh each time it appears.",
        "#{{[token]}}": "A unique 12-character random alphanumeric string, fixed for this email job (boundary tag). Often used for tracking links.",
    },
    "Fixed Length Random String": {
        "{{[rnd]}}": "Random 18-character alphanumeric string (letters A-Z, a-z, and numbers 0-9), generated fresh each time."
    },
    "Variable Length Random Strings (Generated fresh each time)": {
        "{{[rndn_N]}}": "Generates N random numbers (0-9). Example: {{[rndn_10]}}.",
        "{{[rnda_N]}}": "Generates N random alphanumeric characters (A-Z, a-z, 0-9). Example: {{[rnda_12]}}.",
        "{{[rndl_N]}}": "Generates N random lowercase letters (a-z). Example: {{[rndl_8]}}.",
        "{{[rndu_N]}}": "Generates N random uppercase letters (A-Z). Example: {{[rndu_8]}}.",
        "{{[rnds_N]}}": f"Generates N random symbols from the set: {CHAR_SETS['s']}. Example: {{[rnds_5]}}.",
        "{{[rndlu_N]}}": "Generates N random mixed case letters (a-z, A-Z). Example: {{[rndlu_10]}}.",
        "{{[rndln_N]}}": "Generates N random lowercase letters and numbers. Example: {{[rndln_10]}}.",
        "{{[rndun_N]}}": "Generates N random uppercase letters and numbers. Example: {{[rndun_10]}}.",
    },
    "Boundary Tags (Generated once per email job, then reused if tag appears multiple times in that job)": {
        "{{[bndn_N]}}": "Generates N random numbers (0-9), fixed for this email. Example: {{[bndn_10]}}.",
        "{{[bnda_N]}}": "Generates N random alphanumeric characters (fixed for this email). Example: {{[bnda_12]}}.",
        "{{[bndl_N]}}": "Generates N random lowercase letters (fixed for this email). Example: {{[bndl_8]}}.",
        "{{[bndu_N]}}": "Generates N random uppercase letters (fixed for this email). Example: {{[bndu_8]}}.",
        "{{[bnds_N]}}": f"Generates N random symbols (fixed for this email). Example: {{[bnds_5]}}.",
        "{{[bndlu_N]}}": "Generates N random mixed case letters (fixed for this email). Example: {{[bndlu_10]}}.",
        "{{[bndln_N]}}": "Generates N random lowercase letters and numbers (fixed for this email). Example: {{[bndln_10]}}.",
        "{{[bndun_N]}}": "Generates N random uppercase letters and numbers (fixed for this email). Example: {{[bndun_10]}}.",
    }
}

# --- Helper functions for consolidated sender data ---
def _load_all_senders_data_from_consolidated_file():
    try:
        if os.path.exists(ALL_SENDER_ACCOUNTS_FILE_PATH):
            with open(ALL_SENDER_ACCOUNTS_FILE_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content.strip(): return {} # Empty file
                data = json.loads(content)
            if isinstance(data, dict): return data
            else:
                print(f"Warning: Consolidated senders file ('{ALL_SENDER_ACCOUNTS_FILE_PATH}') is not a valid JSON dictionary.")
                return {}
    except json.JSONDecodeError:
        print(f"Warning: Consolidated senders file ('{ALL_SENDER_ACCOUNTS_FILE_PATH}') is not valid JSON.")
        return {}
    except Exception as e:
        print(f"Error loading consolidated senders file ('{ALL_SENDER_ACCOUNTS_FILE_PATH}'): {e}")
        return {}
    return {} # Default to empty dict if file doesn't exist or other issues

def _save_all_senders_data_to_consolidated_file(all_data):
    try:
        if not os.path.exists(CONFIG_DIR_PATH_BASE):
            os.makedirs(CONFIG_DIR_PATH_BASE, exist_ok=True)
        with open(ALL_SENDER_ACCOUNTS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=4)
        return True
    except Exception as e:
        print(f"CRITICAL: Could not save consolidated senders data to '{ALL_SENDER_ACCOUNTS_FILE_PATH}': {e}")
        # Optionally, show a QMessageBox to the user here if GUI context is available
        return False

# --- Optimized Thread Classes ---
class OptimizedEmailSenderThread(QThread):
    send_status_signal = pyqtSignal(str)
    send_finished_signal = pyqtSignal(bool, str, dict)  # success, message, stats
    progress_update_signal = pyqtSignal(int, str) # For individual batch progress
    batch_progress_signal = pyqtSignal(int, int, int)  # completed_in_batch, active_in_batch, total_in_batch
    primary_email_sent_successfully = pyqtSignal(dict) # Emits the config of successfully sent primary email

    def __init__(self, job_batch_of_prepared_emails, sender_config_for_batch, rate_limiters_pool=None):
        super().__init__()
        self.job_batch = job_batch_of_prepared_emails # This batch contains fully prepared email jobs
        self.sender_config = sender_config_for_batch
        self.rate_limiters_pool = rate_limiters_pool or {} # Pool of all rate limiters
        
        # Each batch worker thread uses its own JobQueueManager to manage tasks within its assigned batch
        self.job_queue_manager_for_batch = HighPerformanceJobQueue(max_workers=sender_config_for_batch.get('max_concurrent_tasks_in_batch', 10))
        
        self._is_running_batch_thread = True 
        self.batch_stats = { # Stats for this specific batch
            'total_jobs_in_batch': len(job_batch_of_prepared_emails),
            'completed_in_batch': 0,
            'successful_in_batch': 0,
            'failed_in_batch': 0,
            'batch_start_time': 0,
            'batch_end_time': 0
        }
    
    def run(self):
        thread_name = self.objectName() if self.objectName() else f"BatchThread-{threading.get_ident()}"
        print(f"{thread_name}: Run method started for batch of {self.batch_stats['total_jobs_in_batch']} emails.")
        try:
            self.batch_stats['batch_start_time'] = time.time()
            self.progress_update_signal.emit(10, "Initializing batch...") # Batch-specific progress
            
            if not self.job_batch:
                self.progress_update_signal.emit(100, "Empty batch.")
                self.send_finished_signal.emit(True, "Empty batch processed.", self.batch_stats)
                return

            # Add all jobs from this thread's assigned batch to its internal job queue manager
            for job_idx, prepared_job_data in enumerate(self.job_batch):
                if not self._is_running_batch_thread:
                    print(f"{thread_name}: Stop signal received during job loading (job {job_idx}). Batch aborted.")
                    break 
                
                # If SMTP, attach the correct rate limiter from the pool to the job_data
                # This is crucial for send_email_via_smtp to use it.
                if prepared_job_data.get('type') == 'genericsmtp':
                    server_nickname = prepared_job_data.get('nickname') # Nickname of the SMTP server for this job
                    if server_nickname and server_nickname in self.rate_limiters_pool:
                        prepared_job_data['rate_limiter'] = self.rate_limiters_pool[server_nickname]
                    else:
                        print(f"Warning ({thread_name}): Rate limiter for SMTP server '{server_nickname}' not found in pool. Job for {prepared_job_data.get('recipients_to_list')} might send without rate limit.")
                
                self.job_queue_manager_for_batch.add_job(prepared_job_data)
            
            if not self._is_running_batch_thread: 
                self.send_finished_signal.emit(False, "Batch processing stopped during setup.", self.batch_stats)
                return 
            
            # Determine worker function based on the type of the first job in the batch (all jobs in batch should be same type or handled polymorphically)
            # This assumes a batch contains jobs of the same send_method type (AS or SMTP)
            worker_func_for_send = send_email_via_apps_script if self.job_batch[0].get('type') == 'appsscript' else send_email_via_smtp
            
            # Start processing jobs from this batch's internal queue using the job queue manager's executor
            self.job_queue_manager_for_batch.start_processing(
                worker_func_for_send, 
                self.sender_config.get('max_concurrent_tasks_in_batch', 10) # Concurrency for this batch's tasks
            )
            
            self.progress_update_signal.emit(30, f"Processing {self.batch_stats['total_jobs_in_batch']} emails in this batch...")
            
            # Main loop for this batch thread: get completed tasks and update progress
            while self._is_running_batch_thread and not self.job_queue_manager_for_batch.is_finished():
                # Get results from tasks completed within this batch
                completed_tasks_in_batch = self.job_queue_manager_for_batch.get_completed_jobs(worker_func_for_send)
                
                if not self._is_running_batch_thread: break # Check stop signal after potentially blocking call

                for job_data, result_data, error_str in completed_tasks_in_batch:
                    self.batch_stats['completed_in_batch'] += 1
                    
                    log_id_display = job_data.get('log_identifier_details', {}).get('recipient', 'Unknown Recipient')
                    job_id_short = job_data.get('log_identifier_details', {}).get('job_id_short', '????')
                    source_info = f"{job_data.get('log_identifier_details', {}).get('source_type', '')}({job_data.get('log_identifier_details', {}).get('source_detail', '')})"
                    full_log_str_prefix = f"Job {job_id_short} ({log_id_display}, {source_info})"

                    is_test_job = job_data.get('job_id', '').startswith("TEST_")

                    if error_str: # Error from the future itself (e.g., unhandled exception in worker_function)
                        self.batch_stats['failed_in_batch'] += 1
                        self.send_status_signal.emit(f"FAILED: {full_log_str_prefix} - Task Error: {error_str}")
                    elif result_data and result_data.get('success'):
                        self.batch_stats['successful_in_batch'] += 1
                        elapsed_send_time = result_data.get('elapsed', 0)
                        # The result_data['message'] already contains "AS Success:" or "SMTP Sent"
                        self.send_status_signal.emit(f"SUCCESS: {full_log_str_prefix} ({elapsed_send_time:.2f}s) - {result_data.get('message','')}")
                        if not is_test_job: 
                            self.primary_email_sent_successfully.emit(job_data) 
                    else: # result_data exists but indicates failure, or result_data is None
                        self.batch_stats['failed_in_batch'] += 1
                        message_from_result = result_data.get('message', 'Send function returned no/empty message') if result_data else 'Send function returned no result'
                        # The result_data['message'] now contains detailed errors like "AS Error: ..." or "SMTP Error ..."
                        self.send_status_signal.emit(f"FAILED: {full_log_str_prefix} - {message_from_result}")
                
                if not self._is_running_batch_thread: break # Check again after processing results

                # Update progress for this specific batch
                completed_count, active_count, total_submitted_to_batch_q = self.job_queue_manager_for_batch.get_progress()
                if total_submitted_to_batch_q > 0:
                    # Progress for this batch (0-100 for this batch's internal processing)
                    batch_internal_progress = int((completed_count / total_submitted_to_batch_q) * 100) 
                    self.progress_update_signal.emit(batch_internal_progress, f"Batch {thread_name}: {completed_count}/{total_submitted_to_batch_q}")
                    # Signal for overall UI progress bar (completed in this batch, active in this batch's executor, total in this batch)
                    self.batch_progress_signal.emit(self.batch_stats['completed_in_batch'], active_count, self.batch_stats['total_jobs_in_batch'])

                self.msleep(200) # Brief sleep to yield execution
            
            if not self._is_running_batch_thread:
                 print(f"{thread_name}: Processing loop exited due to stop signal.")
                 self.send_finished_signal.emit(False, f"Batch {thread_name} processing stopped by user.", self.batch_stats)
                 return

            # Batch finished naturally
            self.batch_stats['batch_end_time'] = time.time()
            elapsed_total_for_batch = self.batch_stats['batch_end_time'] - self.batch_stats['batch_start_time']
            
            self.progress_update_signal.emit(100, f"Batch {thread_name} completed!")
            success_rate_for_batch = (self.batch_stats['successful_in_batch'] / self.batch_stats['total_jobs_in_batch']) * 100 if self.batch_stats['total_jobs_in_batch'] > 0 else 0
            avg_speed_for_batch = self.batch_stats['total_jobs_in_batch'] / elapsed_total_for_batch if elapsed_total_for_batch > 0 else 0
            
            final_batch_message = (f"Batch {thread_name}: {self.batch_stats['successful_in_batch']}/{self.batch_stats['total_jobs_in_batch']} successful "
                                   f"({success_rate_for_batch:.1f}%) in {elapsed_total_for_batch:.2f}s (avg {avg_speed_for_batch:.1f} eps for this batch)")
            self.send_finished_signal.emit(True, final_batch_message, self.batch_stats)
                
        except Exception as e:
            import traceback
            self.batch_stats['batch_end_time'] = time.time() # Record time even on error
            error_msg = f"Critical error in {thread_name}: {str(e)} - {traceback.format_exc()}"
            print(error_msg) # Print to console for debugging
            self.send_finished_signal.emit(False, error_msg, self.batch_stats)
        finally:
            # Ensure the job queue manager for this batch is stopped and its executor shut down
            print(f"{thread_name}: Run method finishing. Stopping job queue manager for this batch...")
            if hasattr(self, 'job_queue_manager_for_batch') and self.job_queue_manager_for_batch:
                self.job_queue_manager_for_batch.stop() # This is a blocking call that shuts down its executor
            print(f"{thread_name}: Job queue manager for batch stopped. Run method finished.")
    
    def stop(self):
        thread_name = self.objectName() if self.objectName() else f"BatchThread-{threading.get_ident()}"
        print(f"{thread_name}: Stop method called.")
        self._is_running_batch_thread = False # Signal all loops in run() to terminate
        
        # Signal this batch's job queue manager to stop accepting new tasks from its internal queue
        # and to attempt cancellation of futures.
        if hasattr(self, 'job_queue_manager_for_batch') and self.job_queue_manager_for_batch:
            self.job_queue_manager_for_batch.is_running = False # Prevent submitting more from its internal queue
            
            # Attempt to cancel futures. The manager's own stop() method (called in run()'s finally) will also do this.
            with self.job_queue_manager_for_batch.lock:
                 for future_in_batch_q_mgr in list(self.job_queue_manager_for_batch.active_futures.keys()):
                    if not future_in_batch_q_mgr.running() and not future_in_batch_q_mgr.done():
                        if future_in_batch_q_mgr.cancel():
                             print(f"{thread_name}: Future (in batch Q manager) cancelled by batch thread's stop().")
        
        # The run() method's `finally` block is responsible for the full blocking cleanup of
        # `self.job_queue_manager_for_batch.stop()`. This `stop()` method here just sets flags.
        print(f"{thread_name}: Stop method has set flags; run() method will handle full shutdown of its resources.")


# --- Gemini Subject Generator Thread ---
class GeminiSubjectGeneratorThread(QThread):
    generation_finished = pyqtSignal(bool, list, str) # success, subjects_list, error_message
    
    def __init__(self, api_key, base_prompt_text, num_subjects_to_generate=5):
        super().__init__()
        self.api_key = api_key
        self.base_prompt_text = base_prompt_text
        self.num_subjects = num_subjects_to_generate
        self._is_running_generation = True # Renamed for clarity
    
    def run(self):
        if not GEMINI_API_AVAILABLE:
            self.generation_finished.emit(False, [], f"Gemini library not available. {GEMINI_IMPORT_ERROR}")
            return
        if not self._is_running_generation:
             self.generation_finished.emit(False, [], "Generation stopped before starting.")
             return
        try:
            genai.configure(api_key=self.api_key)
            # Using gemini-1.5-flash-latest as it's fast and cost-effective for this task
            model = genai.GenerativeModel('gemini-1.5-flash-latest') 
            
            prompt = f"""Please generate {self.num_subjects} distinct and highly engaging email subject line variations based on the following core idea, keywords, or full subject: "{self.base_prompt_text}".

Key Guidelines for Subject Lines:
- Be concise and compelling (ideally under 60 characters, maximum 10 words).
- Spark urgency or curiosity where appropriate, but avoid misleading or overly aggressive language.
- Use clear, direct, and professional language suitable for the context.
- Personalization placeholders like '{{{{firstname}}}}' or '{{{{company}}}}' can be included if they fit naturally and add value.
- Strictly avoid using ALL CAPS, excessive exclamation marks (a maximum of one per subject is permissible if contextually strong), and common spam trigger words (e.g., "free money", "guaranteed win", "urgent action required" unless truly applicable and phrased carefully).
- Ensure significant variety in phrasing, tone, and approach across the suggested subject lines.
- Output *only* the subject lines themselves, each on a new line. Do NOT include any numbering, bullet points, introductory text, or concluding remarks. Just the subjects.
"""
            
            if not self._is_running_generation:
                self.generation_finished.emit(False, [], "Generation stopped during API call setup.")
                return
            
            response = model.generate_content(prompt) # API call
            
            if not self._is_running_generation: # Check again after potentially long API call
                self.generation_finished.emit(False, [], "Generation stopped after API call completed.")
                return
            
            generated_text_content = ""
            try: # Robustly extract text from Gemini's response structure
                if response.parts:
                    generated_text_content = "".join(part.text for part in response.parts if hasattr(part, 'text'))
                elif response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                     generated_text_content = "".join(part.text for part in response.candidates[0].content.parts if hasattr(part, 'text'))
                elif hasattr(response, 'text'): # Fallback for simpler response structures
                    generated_text_content = response.text
            except Exception as e:
                print(f"Error accessing Gemini response parts: {e}")
                self.generation_finished.emit(False, [], f"Error processing Gemini response structure: {e}")
                return
            
            if generated_text_content:
                # Split into lines and strip whitespace, filter empty lines
                subjects = [line.strip() for line in generated_text_content.split('\n') if line.strip()]
                # Further filter out common conversational prefixes/suffixes Gemini might add despite prompt
                subjects = [s for s in subjects if s and not s.lower().startswith(("here are", "sure, here", "okay, here", "certainly, here", "i hope these help"))]
                
                if subjects:
                    self.generation_finished.emit(True, subjects, "")
                else:
                    self.generation_finished.emit(False, [], "Gemini generated a response, but no valid subject lines were extracted. Try refining your prompt.")
            else: # No text content generated
                error_info_str = "No content was generated by Gemini."
                if hasattr(response, 'prompt_feedback') and response.prompt_feedback and response.prompt_feedback.block_reason:
                    error_info_str = f"Generation blocked by API (Reason: {response.prompt_feedback.block_reason}). Message: {response.prompt_feedback.block_reason_message if hasattr(response.prompt_feedback, 'block_reason_message') else 'No specific message.'}"
                elif hasattr(response, 'candidates') and not response.candidates:
                    error_info_str = "No candidates found in Gemini response, possibly due to safety filters or an issue with the prompt."
                
                self.generation_finished.emit(False, [], f"Failed to generate subjects. {error_info_str}")
                
        except Exception as e: # Catch-all for other errors (network, API key issues, etc.)
            if self._is_running_generation: # Only emit error if not intentionally stopped
                import traceback
                print(f"GEMINI API ERROR: {traceback.format_exc()}")
                self.generation_finished.emit(False, [], f"Error during Gemini API communication: {str(e)}")
        finally:
            self._is_running_generation = False # Ensure flag is set regardless of how run exits
    
    def stop(self):
        print("GeminiSubjectGeneratorThread: Stop called.")
        self._is_running_generation = False

# --- Sheet Fetcher Thread ---
class SheetFetcherThread(QThread):
    sheet_data_fetched_signal = pyqtSignal(bool, str, str) # success, data_or_error, original_sheet_url
    
    def __init__(self, web_app_url_for_fetch, sheet_url_to_fetch, proxy_dict_for_fetch=None):
        super().__init__()
        self.web_app_url = web_app_url_for_fetch
        self.sheet_url = sheet_url_to_fetch
        self.proxy_dict = proxy_dict_for_fetch
        self._is_running_fetching = True # Renamed for clarity
    
    def run(self):
        try:
            if not self._is_running_fetching:
                self.sheet_data_fetched_signal.emit(False, "Fetching stopped before start.", self.sheet_url)
                return
            if not self.web_app_url:
                self.sheet_data_fetched_signal.emit(False, "No Apps Script Web App URL configured for fetching data.", self.sheet_url)
                return
            
            encoded_sheet_url_param = urllib.parse.quote_plus(self.sheet_url)
            # Apps Script must be deployed to handle this action and parameter
            fetch_target_url = f"{self.web_app_url}?action=getSheetData&sheetUrl={encoded_sheet_url_param}"
            
            # Increased timeout for potentially large sheets or slow Apps Script execution
            response = requests.get(fetch_target_url, timeout=180, proxies=self.proxy_dict) 
            
            if not self._is_running_fetching: # Check after potentially long request
                self.sheet_data_fetched_signal.emit(False, "Fetching stopped during/after request.", self.sheet_url)
                return
            
            if response.ok:
                content_type = response.headers.get('content-type', '').lower()
                # Expecting CSV data as plain text from Apps Script
                if 'text/plain' in content_type or 'text/csv' in content_type:
                    response_text_content = response.text.strip()
                    # Apps Script might return an error message as plain text
                    if response_text_content.lower().startswith("error:"):
                        self.sheet_data_fetched_signal.emit(False, response_text_content, self.sheet_url)
                    else: # Success, data is the text content
                        self.sheet_data_fetched_signal.emit(True, response_text_content, self.sheet_url)
                else:
                    self.sheet_data_fetched_signal.emit(False, f"Unexpected content type from Apps Script: {content_type}. Response (first 200 chars): {response.text[:200]}", self.sheet_url)
            else: # HTTP error (e.g., 401, 404, 500 from Apps Script)
                self.sheet_data_fetched_signal.emit(False, f"Error fetching sheet data (HTTP {response.status_code}): {response.text[:200]}", self.sheet_url)
                
        except requests.exceptions.Timeout:
            if self._is_running_fetching:
                self.sheet_data_fetched_signal.emit(False, "Timeout occurred while fetching Google Sheet data via Apps Script.", self.sheet_url)
        except requests.exceptions.RequestException as e: # Other network errors
            if self._is_running_fetching:
                self.sheet_data_fetched_signal.emit(False, f"Network error during Google Sheet data fetch: {e}", self.sheet_url)
        except Exception as e: # Unexpected errors
            if self._is_running_fetching:
                import traceback
                print(f"UNEXPECTED ERROR IN SHEET FETCHER THREAD: {traceback.format_exc()}")
                self.sheet_data_fetched_signal.emit(False, f"An unexpected error occurred: {e}", self.sheet_url)
        finally:
            self._is_running_fetching = False
    
    def stop(self):
        print("SheetFetcherThread: Stop called.")
        self._is_running_fetching = False

# --- AuthWebEnginePage (for PMTA Dashboard, if used) ---
if WEBENGINE_AVAILABLE:
    class AuthWebEnginePage(QWebEnginePage):
        def __init__(self, profile: QWebEngineProfile, user: str, password: str, parent=None):
            super().__init__(profile, parent)
            self.user = user
            self.password = password
            self.authenticationRequired.connect(self.handle_authentication_required)

        @pyqtSlot(QUrl, QAuthenticator)
        def handle_authentication_required(self, requestUrl: QUrl, authenticator: QAuthenticator):
            # This slot is called when a page requests authentication.
            # Provide the stored credentials.
            if self.user and self.password:
                authenticator.setUser(self.user)
                authenticator.setPassword(self.password)
            # If no user/pass, authentication will likely fail, or a default browser dialog might appear.
else: # Fallback if WebEngine not available
    class AuthWebEnginePage(QWidget): 
        authenticationRequired = pyqtSignal(QUrl, _DummyQAuthenticator) 
        def __init__(self, profile, user, password, parent=None):
            super().__init__(parent)
            # self.user, self.password are not used in dummy version
            print("AuthWebEnginePage (Dummy): Initialized. WebEngine components not available.")


# --- Dialog Classes ---
class ManageAccountsDialogAppsScript(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Manage Apps Script Mailer Accounts")
        self.setMinimumWidth(600)
        self.accounts = self.load_accounts_data_as() # Load current accounts
        
        layout = QVBoxLayout(self)
        info_label = QLabel("<b>Setup Instructions:</b><ol>"
                            "<li>In Google Apps Script, create a new project or open an existing one.</li>"
                            "<li>Paste the provided Apps Script code (<code>gmailSender.gs</code> or similar) into the script editor.</li>"
                            "<li>Deploy the script as a <b>Web App</b>.</li>"
                            "<li>Configure deployment: Execute as '<b>Me</b>', Access '<b>Anyone</b>' (important for public web app).</li>"
                            "<li>Copy the full '<b>Web app URL</b>' provided after deployment (ends with <code>/exec</code>).</li>"
                            "<li>Add accounts here using a unique Nickname, the associated Gmail address, and the Web App URL.</li></ol>")
        info_label.setWordWrap(True)
        info_label.setTextFormat(Qt.RichText)
        layout.addWidget(info_label)
        
        self.accounts_list_widget = QListWidget()
        self.accounts_list_widget.setSelectionMode(QAbstractItemView.SingleSelection)
        self.accounts_list_widget.itemDoubleClicked.connect(self.edit_account)
        layout.addWidget(self.accounts_list_widget)
        
        buttons_layout = QHBoxLayout()
        add_button = QPushButton(QIcon.fromTheme("list-add"), "Add Account")
        add_button.clicked.connect(self.add_account)
        edit_button = QPushButton(QIcon.fromTheme("document-edit"), "Edit Selected")
        edit_button.clicked.connect(self.edit_account)
        remove_button = QPushButton(QIcon.fromTheme("list-remove"), "Remove Selected")
        remove_button.clicked.connect(self.remove_account)
        
        buttons_layout.addWidget(add_button)
        buttons_layout.addWidget(edit_button)
        buttons_layout.addWidget(remove_button)
        buttons_layout.addStretch()
        layout.addLayout(buttons_layout)
        
        self.button_box = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Close)
        self.button_box.button(QDialogButtonBox.Save).setIcon(QIcon.fromTheme("document-save"))
        self.button_box.button(QDialogButtonBox.Close).setIcon(QIcon.fromTheme("window-close"))
        self.button_box.accepted.connect(self.save_and_accept) # Save maps to accepted
        self.button_box.rejected.connect(self.reject) # Close maps to rejected
        layout.addWidget(self.button_box)
        
        self.populate_accounts_list()

    def load_accounts_data_as(self):
        all_data = _load_all_senders_data_from_consolidated_file()
        accounts_list = all_data.get('appsscript_accounts', [])
        if not isinstance(accounts_list, list):
            QMessageBox.warning(self, "Load Error", "Apps Script accounts data in the consolidated file appears to be corrupted (not a list). Starting with an empty list.")
            return []
        return accounts_list

    def save_accounts_data_as(self):
        all_data = _load_all_senders_data_from_consolidated_file()
        all_data['appsscript_accounts'] = self.accounts # self.accounts is the list managed by this dialog
        if _save_all_senders_data_to_consolidated_file(all_data):
            return True
        else:
            QMessageBox.critical(self, "Save Error", f"A critical error occurred while trying to save Apps Script accounts to the consolidated file: '{ALL_SENDER_ACCOUNTS_FILE_PATH}'. Changes might be lost.")
            return False

    def populate_accounts_list(self):
        self.accounts_list_widget.clear()
        if not self.accounts:
            self.accounts_list_widget.addItem(QListWidgetItem("No Apps Script accounts configured yet. Click 'Add Account'."))
            return

        for acc_data in self.accounts:
            # Display: Nickname (or Email if no nickname) - partial URL for brevity
            nickname = acc_data.get('nickname', '').strip()
            email = acc_data.get('email', 'N/A')
            url_part = acc_data.get('web_app_url', 'No URL')[-20:] if acc_data.get('web_app_url') else "No URL"
            display_text = f"{nickname if nickname else email} (URL: ...{url_part})"
            
            item = QListWidgetItem(display_text)
            item.setData(Qt.UserRole, acc_data) # Store full account dict
            tooltip_str = (f"Nickname: {nickname}\n"
                           f"Email: {email}\n"
                           f"Web App URL: {acc_data.get('web_app_url', 'N/A')}\n"
                           f"Sender Display Name: {acc_data.get('sender_display_name', '(Default)')}")
            item.setToolTip(tooltip_str)
            self.accounts_list_widget.addItem(item)
    
    def add_account(self):
        dialog = AccountDetailDialogAppsScript(self) # Pass self as parent
        if dialog.exec_() == QDialog.Accepted:
            new_account_details = dialog.get_account_details()
            # Validation for uniqueness (nickname if provided, email must be unique)
            if new_account_details.get('nickname'):
                if any(acc.get('nickname','').lower() == new_account_details['nickname'].lower() for acc in self.accounts):
                    QMessageBox.warning(self, "Duplicate Nickname", "An Apps Script account with this nickname already exists. Nicknames must be unique if provided.")
                    return
            if any(acc.get('email','').lower() == new_account_details['email'].lower() for acc in self.accounts):
                QMessageBox.warning(self, "Duplicate Email", "An Apps Script account with this Associated Gmail address already exists. Emails must be unique.")
                return

            self.accounts.append(new_account_details)
            self.populate_accounts_list()
    
    def edit_account(self):
        current_item = self.accounts_list_widget.currentItem()
        if not current_item:
            QMessageBox.information(self, "Selection Required", "Please select an Apps Script account from the list to edit.")
            return
        
        original_account_data = current_item.data(Qt.UserRole)
        dialog = AccountDetailDialogAppsScript(self, account_data=original_account_data) # Pass data for edit mode
        if dialog.exec_() == QDialog.Accepted:
            updated_account_data = dialog.get_account_details()
            
            # Uniqueness checks if relevant fields changed
            # Email is read-only in edit mode in AccountDetailDialogAppsScript, so no need to check its uniqueness change here.
            # Check nickname uniqueness if it changed (and is not empty)
            if updated_account_data.get('nickname') and \
               updated_account_data['nickname'].lower() != original_account_data.get('nickname','').lower():
                if any(acc.get('nickname','').lower() == updated_account_data['nickname'].lower() and \
                       acc.get('email','').lower() != original_account_data.get('email','').lower() # Exclude self
                       for acc in self.accounts):
                    QMessageBox.warning(self, "Duplicate Nickname", "Another Apps Script account with this new nickname already exists.")
                    return

            # Find and update the account in self.accounts list
            # Assuming email is the primary unique identifier that doesn't change in edit mode.
            for i, acc in enumerate(self.accounts):
                if acc.get('email','').lower() == original_account_data.get('email','').lower():
                    self.accounts[i] = updated_account_data
                    break
            self.populate_accounts_list()
    
    def remove_account(self):
        current_item = self.accounts_list_widget.currentItem()
        if not current_item:
            QMessageBox.information(self, "Selection Required", "Please select an Apps Script account to remove.")
            return
        
        account_to_remove_data = current_item.data(Qt.UserRole)
        identifier = account_to_remove_data.get('nickname') or account_to_remove_data.get('email', 'Unknown Account')

        reply = QMessageBox.question(self, "Confirm Removal", 
                                     f"Are you sure you want to remove the Apps Script account: '{identifier}'?", 
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            # Remove by matching the unique email (assuming it's the key)
            self.accounts = [acc for acc in self.accounts 
                             if acc.get('email','').lower() != account_to_remove_data.get('email','').lower()]
            self.populate_accounts_list()
    
    def save_and_accept(self):
        if self.save_accounts_data_as(): # save_accounts_data_as handles messaging on failure
            self.accept() # Closes dialog with QDialog.Accepted status

class AccountDetailDialogAppsScript(QDialog):
    def __init__(self, parent=None, account_data=None): # parent is ManageAccountsDialogAppsScript
        super().__init__(parent)
        self.is_edit_mode = account_data is not None
        self.original_email_for_edit = account_data.get('email', '').lower() if self.is_edit_mode else '' # Store original email
        
        self.setWindowTitle("Edit Apps Script Account" if self.is_edit_mode else "Add New Apps Script Account")
        self.setMinimumWidth(550)
        
        layout = QFormLayout(self)
        layout.setFieldGrowthPolicy(QFormLayout.ExpandingFieldsGrow) # Allow fields to expand
        
        self.nickname_input = QLineEdit(account_data.get('nickname', '') if account_data else '')
        self.nickname_input.setPlaceholderText("e.g., Main Sender, Marketing Account (Optional, but unique if used)")
        
        self.email_input = QLineEdit(account_data.get('email', '') if account_data else '')
        self.email_input.setPlaceholderText("user@gmail.com (Must be the Gmail account that owns the Apps Script)")
        
        lbl_url = QLabel("Web App URL:")
        self.web_app_url_input = QLineEdit(account_data.get('web_app_url', '') if account_data else '')
        self.web_app_url_input.setPlaceholderText("https://script.google.com/macros/s/AKfy.../exec")
        lbl_url.setToolTip("The full 'Web app URL' obtained after deploying your Apps Script project.")
        self.web_app_url_input.setToolTip("The full 'Web app URL' obtained after deploying your Apps Script project.")
        
        self.sender_display_name_input = QLineEdit(account_data.get('sender_display_name', '') if account_data else '')
        self.sender_display_name_input.setPlaceholderText("e.g., Your Company Name, Support Team (Optional)")
        lbl_sender_name = QLabel("Sender Display Name (Optional):")
        lbl_sender_name.setToolTip("If set, this name will be used as the 'From' display name when sending via this Apps Script.\nOverrides the default name associated with the Gmail account for this specific Apps Script mailer.")
        
        layout.addRow("Nickname (Unique, Optional):", self.nickname_input)
        layout.addRow("Associated Gmail (Required, Unique):", self.email_input)
        layout.addRow(lbl_url, self.web_app_url_input)
        layout.addRow(lbl_sender_name, self.sender_display_name_input)
        
        self.button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        self.button_box.button(QDialogButtonBox.Ok).setIcon(QIcon.fromTheme("dialog-ok-apply"))
        self.button_box.button(QDialogButtonBox.Cancel).setIcon(QIcon.fromTheme("dialog-cancel"))
        self.button_box.accepted.connect(self.validate_and_accept) # Ok maps to accepted
        self.button_box.rejected.connect(self.reject) # Cancel maps to rejected
        layout.addWidget(self.button_box)
        
        # In edit mode, make the email (primary identifier) read-only to prevent accidental changes
        # that could break references or uniqueness logic in the parent dialog.
        if self.is_edit_mode:
            self.email_input.setReadOnly(True)
            self.email_input.setStyleSheet("QLineEdit { background-color: #f0f0f0; color: #505050; }") # Visual cue
            self.email_input.setToolTip("Associated Gmail is the primary identifier and cannot be changed in edit mode. To change it, remove and re-add the account.")
    
    def validate_and_accept(self):
        email = self.email_input.text().strip().lower() # Normalize to lowercase for consistency
        url = self.web_app_url_input.text().strip()
        nickname = self.nickname_input.text().strip() # Keep case for display, compare lowercase for uniqueness

        if not email or "@" not in email or "." not in email.split("@")[-1]: # Basic email validation
            QMessageBox.warning(self, "Validation Error", "A valid 'Associated Gmail' address is required.")
            self.email_input.setFocus()
            return
        if not url or not url.startswith("https://script.google.com/macros/s/") or not url.endswith("/exec"):
            QMessageBox.warning(self, "Validation Error", "A valid Apps Script 'Web App URL' is required. It must start with 'https://script.google.com/macros/s/' and end with '/exec'.")
            self.web_app_url_input.setFocus()
            return
        
        # Uniqueness checks (email, nickname) are primarily handled by the parent ManageAccountsDialogAppsScript
        # when adding or confirming edits, as it has access to the full list of accounts.
        # This dialog focuses on individual field format validation.
        
        self.accept() # If basic validation passes, accept the dialog
    
    def get_account_details(self):
        # Returns details for the parent dialog to process
        return {
            "nickname": self.nickname_input.text().strip(), # Store with original casing
            "email": self.email_input.text().strip().lower(), # Store email as lowercase for consistent ID
            "web_app_url": self.web_app_url_input.text().strip(),
            "sender_display_name": self.sender_display_name_input.text().strip()
        }

class GenericSMTPServerDetailDialog(QDialog):
    def __init__(self, parent=None, server_data=None): # parent is ManageGenericSMTPServersDialog
        super().__init__(parent)
        self.is_edit_mode = server_data is not None
        self.original_nickname_for_edit = server_data.get('nickname', '').lower() if self.is_edit_mode else ''
        
        self.setWindowTitle("Edit Generic SMTP Server" if self.is_edit_mode else "Add New Generic SMTP Server")
        self.setMinimumWidth(580) # Increased width for more content
        
        main_layout = QVBoxLayout(self)
        scroll_area = QScrollArea(self) # Make content scrollable if it exceeds dialog height
        scroll_area.setWidgetResizable(True)
        main_layout.addWidget(scroll_area)
        
        scroll_content_widget = QWidget()
        scroll_area.setWidget(scroll_content_widget)
        form_layout = QFormLayout(scroll_content_widget) # Use form layout for scroll content
        form_layout.setFieldGrowthPolicy(QFormLayout.ExpandingFieldsGrow)

        # --- Server Identity ---
        self.nickname_input = QLineEdit(server_data.get('nickname', '') if server_data else '')
        self.nickname_input.setPlaceholderText("e.g., Gmail Personal, SendGrid API, Local SMTP")
        
        # --- Connection Details ---
        self.host_input = QLineEdit(server_data.get('host', '') if server_data else '')
        self.host_input.setPlaceholderText("e.g., smtp.gmail.com, smtp.sendgrid.net, localhost")
        
        self.port_input = QLineEdit(str(server_data.get('port', 587)) if server_data else '587')
        self.port_input.setValidator(QIntValidator(1, 65535, self)) # Port range validation
        
        self.encryption_combo = QComboBox()
        self.encryption_combo.addItems(["TLS (STARTTLS)", "SSL", "None"])
        current_encryption = "TLS (STARTTLS)" # Default
        if server_data:
            enc_setting = server_data.get('encryption', "TLS (STARTTLS)")
            if enc_setting in ["TLS (STARTTLS)", "SSL", "None"]: current_encryption = enc_setting
        self.encryption_combo.setCurrentText(current_encryption)

        # --- Authentication ---
        self.username_input = QLineEdit(server_data.get('username', '') if server_data else '')
        self.username_input.setPlaceholderText("e.g., user@example.com, apikey (for SendGrid)")
        
        self.password_input = QLineEdit(server_data.get('password', '') if server_data else '')
        self.password_input.setEchoMode(QLineEdit.Password)
        self.password_input.setPlaceholderText("Your email password, app password, or API key secret")

        # --- Sender Information ---
        self.from_address_input = QLineEdit(server_data.get('from_address', '') if server_data else '')
        self.from_address_input.setPlaceholderText("Optional: Your Name <email@example.com> or just email@example.com")
        self.from_address_input.setToolTip("If set, this is the default 'From' address (email and optionally display name) for this server.\nCan be overridden by email content's 'From Name' settings or custom headers during campaign setup.")

        # --- Rate Limiting (Advanced) ---
        rate_limit_group = QGroupBox("⚙️ Advanced Rate Limiting (per server)")
        rate_limit_group_layout = QFormLayout(rate_limit_group) # Use FormLayout for better alignment
        
        self.rate_limit_emails_spinbox = QSpinBox()
        self.rate_limit_emails_spinbox.setRange(0, 10000) # Allow 0 for unlimited (handled in limiter logic)
        self.rate_limit_emails_spinbox.setValue(int(server_data.get('rate_limit_emails', 10)) if server_data else 10)
        self.rate_limit_emails_spinbox.setToolTip("Number of emails allowed. Set to 0 for effectively unlimited (very high rate).")

        self.rate_limit_seconds_spinbox = QDoubleSpinBox()
        self.rate_limit_seconds_spinbox.setDecimals(1)
        self.rate_limit_seconds_spinbox.setRange(0.1, 600.0) # e.g., 0.1 seconds to 10 minutes
        self.rate_limit_seconds_spinbox.setValue(float(server_data.get('rate_limit_seconds', 1.0)) if server_data else 1.0)
        self.rate_limit_seconds_spinbox.setToolTip("Time period in seconds for the above email count (e.g., 10 emails per 1.0 second).")
        
        self.burst_size_spinbox = QSpinBox()
        self.burst_size_spinbox.setRange(1, 500) # Max burst capacity
        self.burst_size_spinbox.setValue(int(server_data.get('burst_size', 5)) if server_data else 5)
        self.burst_size_spinbox.setToolTip("Maximum number of emails that can be sent in a quick burst, exceeding the sustained rate temporarily.")

        rate_limit_group_layout.addRow("Max Emails:", self.rate_limit_emails_spinbox)
        rate_limit_group_layout.addRow("Per Seconds:", self.rate_limit_seconds_spinbox)
        rate_limit_group_layout.addRow("Burst Capacity:", self.burst_size_spinbox)
        rate_limit_group_layout.addRow(QLabel("<i>Note: Set 'Max Emails' to 0 for effectively unlimited rate.</i>"))


        form_layout.addRow("<b>Server Nickname (Required, Unique):</b>", self.nickname_input)
        form_layout.addRow(QLabel("<b><u>Connection Details:</u></b>"))
        form_layout.addRow("SMTP Host (Required):", self.host_input)
        form_layout.addRow("SMTP Port (Required):", self.port_input)
        form_layout.addRow("Encryption:", self.encryption_combo)
        form_layout.addRow(QLabel("<b><u>Authentication:</u></b>"))
        form_layout.addRow("Username/API Key:", self.username_input)
        form_layout.addRow("Password/App Password:", self.password_input)
        form_layout.addRow(QLabel("<b><u>Default Sender:</u></b>"))
        form_layout.addRow("Default From Address (Optional):", self.from_address_input)
        form_layout.addRow(rate_limit_group)

        self.button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        self.button_box.button(QDialogButtonBox.Ok).setIcon(QIcon.fromTheme("dialog-ok-apply"))
        self.button_box.button(QDialogButtonBox.Cancel).setIcon(QIcon.fromTheme("dialog-cancel"))
        self.button_box.accepted.connect(self.validate_and_accept)
        self.button_box.rejected.connect(self.reject)
        main_layout.addWidget(self.button_box)

        # Nickname is primary key, make read-only in edit mode
        if self.is_edit_mode and server_data.get('nickname'):
            self.nickname_input.setReadOnly(True)
            self.nickname_input.setStyleSheet("QLineEdit { background-color: #f0f0f0; color: #505050; }")
            self.nickname_input.setToolTip("Nickname is the primary identifier and cannot be changed in edit mode. To change it, remove and re-add the server.")

    def validate_and_accept(self):
        nickname = self.nickname_input.text().strip()
        if not nickname:
            QMessageBox.warning(self, "Validation Error", "Server Nickname is required and must be unique.")
            self.nickname_input.setFocus()
            return
        if not self.host_input.text().strip():
            QMessageBox.warning(self, "Validation Error", "SMTP Host is required.")
            self.host_input.setFocus()
            return
        
        port_str = self.port_input.text().strip()
        if not port_str or not port_str.isdigit() or not (1 <= int(port_str) <= 65535):
            QMessageBox.warning(self, "Validation Error", "SMTP Port is required and must be a number between 1 and 65535.")
            self.port_input.setFocus()
            return

        # Rate limit validation
        emails = self.rate_limit_emails_spinbox.value()
        seconds = self.rate_limit_seconds_spinbox.value()
        if emails > 0 and seconds <= 0: # If rate is limited (emails > 0)
            QMessageBox.warning(self, "Validation Error", "If 'Max Emails' for rate limit is greater than 0, 'Per Seconds' must also be greater than 0 (e.g., 0.1 or higher).")
            self.rate_limit_seconds_spinbox.setFocus()
            return
        
        # Uniqueness of nickname (if changed, though it's read-only in edit) is handled by parent dialog.
        self.accept()

    def get_server_details(self):
        return {
            "nickname": self.nickname_input.text().strip(), # Store with original casing
            "host": self.host_input.text().strip(),
            "port": int(self.port_input.text()) if self.port_input.text().strip().isdigit() else 587, # Fallback port
            "username": self.username_input.text().strip(),
            "password": self.password_input.text(), # Keep password as is (no stripping)
            "encryption": self.encryption_combo.currentText(),
            "from_address": self.from_address_input.text().strip(),
            "rate_limit_emails": self.rate_limit_emails_spinbox.value(),
            "rate_limit_seconds": self.rate_limit_seconds_spinbox.value(),
            "burst_size": self.burst_size_spinbox.value()
        }

class ManageGenericSMTPServersDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Manage Generic SMTP Servers")
        self.setMinimumWidth(700) # Wider for more info in list
        self.servers = self.load_generic_smtp_servers_data() # Load current servers

        layout = QVBoxLayout(self)
        info_label = QLabel("Configure Generic SMTP servers for sending emails. Each server can have its own rate limits and burst settings for optimized delivery. Nicknames must be unique.")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        self.servers_list_widget = QListWidget()
        self.servers_list_widget.setSelectionMode(QAbstractItemView.SingleSelection)
        self.servers_list_widget.itemDoubleClicked.connect(self.edit_server)
        layout.addWidget(self.servers_list_widget)

        buttons_layout = QHBoxLayout()
        add_button = QPushButton(QIcon.fromTheme("list-add"), "Add Server")
        add_button.clicked.connect(self.add_server)
        edit_button = QPushButton(QIcon.fromTheme("document-edit"), "Edit Selected")
        edit_button.clicked.connect(self.edit_server)
        remove_button = QPushButton(QIcon.fromTheme("list-remove"), "Remove Selected")
        remove_button.clicked.connect(self.remove_server)
        
        buttons_layout.addWidget(add_button)
        buttons_layout.addWidget(edit_button)
        buttons_layout.addWidget(remove_button)
        buttons_layout.addStretch()
        layout.addLayout(buttons_layout)

        self.button_box = QDialogButtonBox(QDialogButtonBox.Save | QDialogButtonBox.Close)
        self.button_box.button(QDialogButtonBox.Save).setIcon(QIcon.fromTheme("document-save"))
        self.button_box.button(QDialogButtonBox.Close).setIcon(QIcon.fromTheme("window-close"))
        self.button_box.accepted.connect(self.save_and_accept)
        self.button_box.rejected.connect(self.reject)
        layout.addWidget(self.button_box)

        self.populate_servers_list()

    def load_generic_smtp_servers_data(self):
        all_data = _load_all_senders_data_from_consolidated_file()
        servers_list = all_data.get('generic_smtp_servers', [])
        if not isinstance(servers_list, list):
            QMessageBox.warning(self, "Load Error", "Generic SMTP Servers data in the consolidated file is corrupted. Starting with an empty list.")
            return []
        return servers_list

    def save_generic_smtp_servers_data(self):
        all_data = _load_all_senders_data_from_consolidated_file()
        all_data['generic_smtp_servers'] = self.servers
        if _save_all_senders_data_to_consolidated_file(all_data):
            return True
        else:
            QMessageBox.critical(self, "Save Error", f"Could not save Generic SMTP Servers to the consolidated file: '{ALL_SENDER_ACCOUNTS_FILE_PATH}'. Changes may be lost.")
            return False
    
    def populate_servers_list(self):
        self.servers_list_widget.clear()
        if not self.servers:
            self.servers_list_widget.addItem(QListWidgetItem("No Generic SMTP servers configured. Click 'Add Server'."))
            return

        for server_data in self.servers:
            nickname = server_data.get('nickname', 'Unnamed Server')
            host_info = f"{server_data.get('host', 'N/A')}:{server_data.get('port', 'N/A')}"
            
            emails = int(server_data.get('rate_limit_emails', 0))
            seconds = float(server_data.get('rate_limit_seconds', 1.0))
            burst = int(server_data.get('burst_size', 1)) # Min burst 1
            
            if emails > 0 and seconds > 0:
                rate_display_str = f"{emails} email(s) / {seconds:.1f}s (burst: {burst})"
            else: # Effectively unlimited
                rate_display_str = "Unlimited (High Rate)"

            display_text = f"{nickname} ({host_info}) - Rate: {rate_display_str}"
            item = QListWidgetItem(display_text)
            item.setData(Qt.UserRole, server_data)
            
            tooltip_parts = [
                f"Nickname: {nickname}",
                f"Host: {host_info}",
                f"User: {server_data.get('username', '(Not set)')}",
                f"Encryption: {server_data.get('encryption', 'N/A')}",
                f"Default From: {server_data.get('from_address', '(Not set)')}",
                f"Rate Limit: {rate_display_str}"
            ]
            item.setToolTip("\n".join(tooltip_parts))
            self.servers_list_widget.addItem(item)

    def add_server(self):
        dialog = GenericSMTPServerDetailDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            new_server_details = dialog.get_server_details()
            # Check for duplicate nickname (case-insensitive) before adding
            if any(s.get('nickname','').lower() == new_server_details['nickname'].lower() for s in self.servers):
                QMessageBox.warning(self, "Duplicate Nickname", "A Generic SMTP server with this nickname already exists. Nicknames must be unique.")
                return
            self.servers.append(new_server_details)
            self.populate_servers_list()

    def edit_server(self):
        current_item = self.servers_list_widget.currentItem()
        if not current_item:
            QMessageBox.information(self, "Selection Required", "Please select a Generic SMTP server from the list to edit.")
            return
        
        original_server_data = current_item.data(Qt.UserRole)
        dialog = GenericSMTPServerDetailDialog(self, server_data=original_server_data)
        if dialog.exec_() == QDialog.Accepted:
            updated_server_data = dialog.get_server_details()
            # Nickname is read-only in edit mode, so no need to check for duplicate on change here.
            # Find and update by original nickname (which is the key and non-editable in dialog)
            for i, srv in enumerate(self.servers):
                if srv.get('nickname','').lower() == original_server_data.get('nickname','').lower():
                    self.servers[i] = updated_server_data
                    break
            self.populate_servers_list()

    def remove_server(self):
        current_item = self.servers_list_widget.currentItem()
        if not current_item:
            QMessageBox.information(self, "Selection Required", "Please select a Generic SMTP server to remove.")
            return
        
        server_to_remove_data = current_item.data(Qt.UserRole)
        nickname_to_remove = server_to_remove_data.get('nickname', 'Unknown Server')

        reply = QMessageBox.question(self, "Confirm Removal", 
                                     f"Are you sure you want to remove the SMTP server: '{nickname_to_remove}'?",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            # Remove by matching nickname (case-insensitive for robustness, though stored with case)
            self.servers = [s for s in self.servers 
                            if s.get('nickname','').lower() != server_to_remove_data.get('nickname','').lower()]
            self.populate_servers_list()

    def save_and_accept(self):
        if self.save_generic_smtp_servers_data():
            self.accept()

class TagsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Usable Dynamic Tags Guide")
        self.setMinimumSize(700, 500) # Wider for better description visibility
        layout = QVBoxLayout(self)

        intro_label = QLabel("These dynamic tags can be used in 'From Name', 'Subject', 'Email Body', and 'Custom Headers'. "
                             "Placeholders like <code>{{ColumnHeaderFromData}}</code> are for data from your CSV/Excel/GSheet source. "
                             "Tags are case-sensitive as shown. Double-click a tag to copy it.")
        intro_label.setWordWrap(True)
        intro_label.setTextFormat(Qt.RichText) # Allow <code>
        layout.addWidget(intro_label)

        self.tags_tree = QTreeWidget()
        self.tags_tree.setColumnCount(2)
        self.tags_tree.setHeaderLabels(["Tag", "Description & Usage"])
        self.tags_tree.header().setSectionResizeMode(0, QHeaderView.ResizeToContents) # Tag column
        self.tags_tree.header().setSectionResizeMode(1, QHeaderView.Stretch) # Description column stretches

        for category_name, tags_in_category_dict in USABLE_TAGS_STRUCTURE.items():
            category_item = QTreeWidgetItem(self.tags_tree, [category_name])
            category_item.setFlags(category_item.flags() & ~Qt.ItemIsSelectable) # Make categories non-selectable
            for tag_name, tag_desc in tags_in_category_dict.items():
                # Make tag name bold for clarity in the tree
                tag_item = QTreeWidgetItem(category_item)
                tag_item.setText(0, tag_name) # Set text for column 0 (Tag)
                tag_item.setText(1, tag_desc) # Set text for column 1 (Description)
            self.tags_tree.expandItem(category_item)

        self.tags_tree.itemDoubleClicked.connect(self.copy_tag_on_double_click)
        layout.addWidget(self.tags_tree)

        copy_button = QPushButton(QIcon.fromTheme("edit-copy"), "Copy Selected Tag to Clipboard")
        copy_button.setToolTip("Select a tag from the tree (not a category) and click to copy.")
        copy_button.clicked.connect(self.copy_selected_tag_via_button)
        layout.addWidget(copy_button)
        
        self.button_box = QDialogButtonBox(QDialogButtonBox.Close)
        self.button_box.button(QDialogButtonBox.Close).setIcon(QIcon.fromTheme("window-close"))
        self.button_box.rejected.connect(self.reject) 
        layout.addWidget(self.button_box)

    def _copy_tag_to_clipboard(self, tag_text):
        QApplication.clipboard().setText(tag_text)
        # Try to access main window's status bar via parent or QApplication instance
        main_window_ref = self.parent()
        if not main_window_ref or not hasattr(main_window_ref, 'status_bar'):
            if hasattr(QApplication.instance(), 'main_window'):
                 main_window_ref = QApplication.instance().main_window
        
        if main_window_ref and hasattr(main_window_ref, 'status_bar') and main_window_ref.status_bar:
            main_window_ref.status_bar.showMessage(f"Tag '{tag_text}' copied to clipboard!", 2500)

    def copy_tag_on_double_click(self, item, column): # item is QTreeWidgetItem
        if item and item.childCount() == 0: # Ensure it's a leaf node (a tag), not a category
            tag_text_to_copy = item.text(0) # Tag name is in the first column
            self._copy_tag_to_clipboard(tag_text_to_copy)

    def copy_selected_tag_via_button(self):
        selected_items = self.tags_tree.selectedItems()
        if selected_items:
            item = selected_items[0] # Get the first (should be only) selected item
            if item and item.childCount() == 0: # Ensure it's a tag
                tag_text_to_copy = item.text(0)
                self._copy_tag_to_clipboard(tag_text_to_copy)
            else:
                QMessageBox.information(self, "Selection Info", "Please select an actual tag from the list (not a category header) to copy.")
        else:
            QMessageBox.information(self, "Selection Required", "Please select a tag from the list first.")


# --- Main Application Window ---
# --- Main Application Window ---
class MailerApp(QMainWindow):
    def __init__(self):
        super().__init__()

        # Critical: Ensure config directory exists or app cannot function
        if not os.path.exists(CONFIG_DIR_PATH_BASE):
            try:
                os.makedirs(CONFIG_DIR_PATH_BASE, exist_ok=True)
            except OSError as e:
                # This might be too early for QMessageBox if app instance isn't fully up.
                # Print critical error and exit.
                print(f"CRITICAL STARTUP FAILURE: Error creating config directory {CONFIG_DIR_PATH_BASE}: {e}")
                # A QMessageBox here might work if QApplication is already partially initialized by the `if __name__ == '__main__':` block
                # For robustness, a print and hard exit is safest if this fails.
                QMessageBox.critical(None, "Fatal Startup Error", f"Could not create configuration directory:\n{CONFIG_DIR_PATH_BASE}\nError: {e}\n\nThe application cannot continue and will now exit.")
                sys.exit(1) # Hard exit

        self.settings = QSettings("MyCompanyOrAppName", CONFIG_DIR_NAME_BASE + APP_VERSION_SUFFIX) # Use unique app name for settings

        # --- Core Email Processing State ---
        # self.email_job_queue will store fully prepared email job dictionaries.
        # This is the "entire campaign" prepared before sending.
        self.email_job_queue = [] 
        self.current_job_index_for_dispatch = 0 # Tracks index for dispatching batches from self.email_job_queue
        
        self.active_batch_send_workers = [] # Holds active OptimizedEmailSenderThread instances for batches
        self.active_test_email_workers = [] # Holds active OptimizedEmailSenderThread instances for test emails

        self.max_concurrent_sends_per_batch_worker = self.settings.value(MAX_CONCURRENT_SENDS_SETTING, 20, type=int) 
        self.batch_size_for_main_workers = self.settings.value("batch_size", 50, type=int) # Number of emails per OptimizedEmailSenderThread
        
        self.queue_processing_active = False # True when "Start" is pressed and not stopped/finished
        self.is_paused_flag = False # True if user paused processing
        
        # Performance Monitoring Stats
        self.total_emails_processed_overall = 0
        self.total_emails_successful_overall = 0
        self.overall_processing_start_time = 0
        self.overall_processing_end_time = 0 # For final stats
        
        # SMTP Rate Limiters: Dictionary of { 'server_nickname': AdvancedRateLimiter_instance }
        self.rate_limiters_pool = {} # Central pool of rate limiters
        
        self.tags_dialog_instance = None # To ensure only one instance of TagsDialog
        
        # Lists of configured accounts (loaded from file)
        self.configured_as_accounts = []
        self.configured_generic_smtp_servers = []

        self.current_theme = "yahoo" # Default theme, loaded/applied later
        self.gemini_api_key = "" # Loaded from settings
        self.gemini_api_key_input_field = None # UI field reference

        # HTML to Text Converter
        self.html_to_text_converter = html2text.HTML2Text()
        self.html_to_text_converter.ignore_links = False # Keep links in plain text
        self.html_to_text_converter.ignore_images = True # Images are not useful in plain text
        self.html_to_text_converter.body_width = 0 # No wrapping

        # Data Source State
        self.data_content_from_file_or_url = None # Holds CSV string from Excel/GSheet
        self.loaded_excel_file_path = None
        self.loaded_google_sheet_url = None 

        # Utility Threads
        self.sheet_fetcher_thread_instance = None
        self.gemini_subject_gen_thread_instance = None

        # Proxy Settings (attributes, populated by load_app_settings)
        self.proxy_is_enabled = False
        self.proxy_config_type = "HTTP"
        self.proxy_config_host = ""
        self.proxy_config_port = ""
        self.proxy_config_user = ""
        self.proxy_config_pass = ""
        # UI elements for proxy will be assigned during init_ui

        # References to UI elements for easy access
        self.sender_accounts_list_widget_generic_smtp_ref = None 
        self.compose_tab_horizontal_splitter = None 
        # self.content_tab_horizontal_splitter = None # Not currently used, but can be if Content tab gets split

        # Test Email Feature state
        self.test_email_target_address = ""
        self.test_email_trigger_count = 0 # Send test after X emails
        self.primary_emails_sent_since_last_test = 0
        self.test_email_address_input_field = None 
        self.test_after_x_emails_spinbox_ref = None 

        self.init_ui() # Initialize all UI elements
        self.load_application_settings() 
        self.apply_stylesheet(self.settings.value("theme", self.current_theme))
        
        # Load sender configurations from storage
        self.load_configured_as_accounts() 
        self.load_configured_generic_smtp_servers() # <--- CALLED HERE
        
        self.populate_send_via_combo_from_settings()

        # Inform user about missing optional libraries via status bar
        if not PANDAS_AVAILABLE and hasattr(self, 'status_bar') and self.status_bar:
            self.status_bar.showMessage(PANDAS_IMPORT_ERROR, 10000)
        if not GEMINI_API_AVAILABLE and hasattr(self, 'status_bar') and self.status_bar:
             self.status_bar.showMessage(GEMINI_IMPORT_ERROR, 10000)

        self.update_ai_tools_tab_status_display() # Reflect current AI capability in UI
        QApplication.instance().main_window = self # For global access if needed (e.g., by dialogs)

    def init_ui(self):
        self.setWindowTitle(f"High-Speed Email Mailer (v{APP_VERSION_SUFFIX.split('_V2_')[-1] if '_V2_' in APP_VERSION_SUFFIX else APP_VERSION_SUFFIX})")
        self.setGeometry(100, 100, 1400, 950) # Slightly larger default size
        
        try: # Set application icon
            icon = QIcon.fromTheme("mail-message-new", QIcon.fromTheme("mail-unread", QIcon(":/icons/app_icon.png"))) 
            if icon.isNull(): icon = QIcon("app_icon.png") # Fallback to local file if theme icon fails
            if not icon.isNull(): self.setWindowIcon(icon)
            else: print("Could not find a suitable application icon (mail-message-new or app_icon.png).")
        except Exception as e:
            print(f"Error setting window icon: {e}")

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_app_layout = QVBoxLayout(central_widget)
        main_app_layout.setContentsMargins(8, 8, 8, 8) # Reduced margins slightly

        self._create_main_actions()
        self._create_main_menu_bar()
        self._create_main_toolbar()
        
        self.main_tab_widget = QTabWidget() # Renamed for clarity
        self.main_tab_widget.setObjectName("MainTabWidget") 
        self.main_tab_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        main_app_layout.addWidget(self.main_tab_widget)

        # --- Tab 1: Campaign Setup & Control ---
        compose_tab_widget = QWidget()
        compose_tab_main_layout = QHBoxLayout(compose_tab_widget)
        compose_tab_main_layout.setSpacing(8)

        self.compose_tab_horizontal_splitter = QSplitter(Qt.Horizontal)
        self.compose_tab_horizontal_splitter.setObjectName("ComposeHorizontalSplitter")
        self.compose_tab_horizontal_splitter.setChildrenCollapsible(False)
        compose_tab_main_layout.addWidget(self.compose_tab_horizontal_splitter)

        # Left Pane: Sending Configuration & Recipients
        compose_left_pane_widget = QWidget()
        compose_left_pane_layout = QVBoxLayout(compose_left_pane_widget)
        compose_left_pane_layout.setSpacing(8)
        self.compose_tab_horizontal_splitter.addWidget(compose_left_pane_widget)

        # High-Speed Settings Group
        performance_settings_group = QGroupBox("⚡ High-Speed Sending Configuration")
        performance_settings_layout = QFormLayout(performance_settings_group)
        
        self.max_concurrent_sends_spinbox_ref = QSpinBox()
        self.max_concurrent_sends_spinbox_ref.setRange(1, 200) 
        self.max_concurrent_sends_spinbox_ref.setValue(self.max_concurrent_sends_per_batch_worker)
        self.max_concurrent_sends_spinbox_ref.setToolTip("Maximum parallel email sending operations *within each batch worker*.\nHigher values can speed up sending but increase server load and risk of blocks.")
        self.max_concurrent_sends_spinbox_ref.valueChanged.connect(self.on_max_concurrent_sends_changed)
        
        self.batch_size_spinbox_ref = QSpinBox()
        self.batch_size_spinbox_ref.setRange(10, 2000) # Increased max batch size
        self.batch_size_spinbox_ref.setValue(self.batch_size_for_main_workers)
        self.batch_size_spinbox_ref.setToolTip("Number of emails grouped into a single processing batch assigned to one main worker thread.\nLarger batches can be more efficient for very large campaigns but take longer for individual batch progress updates.")
        self.batch_size_spinbox_ref.valueChanged.connect(self.on_batch_size_changed)
        
        performance_settings_layout.addRow("Max Concurrent Sends (per batch worker):", self.max_concurrent_sends_spinbox_ref)
        performance_settings_layout.addRow("Main Batch Size (emails per worker):", self.batch_size_spinbox_ref)
        compose_left_pane_layout.addWidget(performance_settings_group)

        # Send Method Selection Group
        send_method_selection_group = QGroupBox("1. Email Sending Method & Accounts")
        send_method_selection_layout = QVBoxLayout(send_method_selection_group) # Changed to QVBoxLayout
        
        send_via_layout = QHBoxLayout() # For combo box
        send_via_layout.addWidget(QLabel("Send Emails Via:"))
        self.send_via_combo_box = QComboBox() # Renamed
        self.send_via_combo_box.addItems(["Google Apps Script", "Generic SMTP Server"]) # PMTA can be added later
        self.send_via_combo_box.currentIndexChanged.connect(self.on_send_method_changed_update_visibility)
        send_via_layout.addWidget(self.send_via_combo_box, 1)
        send_method_selection_layout.addLayout(send_via_layout)

        # StackedWidget for sender-specific configurations (AS, SMTP)
        self.sender_config_stacked_widget = QStackedWidget() # Renamed
        self.sender_config_stacked_widget.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        # Add a small note about the stacked widget behavior for clarity
        stack_note = QLabel("<i>Select accounts below for the chosen sending method. Only one configuration panel is shown at a time.</i>")
        stack_note.setWordWrap(True)
        send_method_selection_layout.addWidget(stack_note)
        send_method_selection_layout.addWidget(self.sender_config_stacked_widget) # Add stack to group
        compose_left_pane_layout.addWidget(send_method_selection_group)

        # Apps Script sender configuration page
        as_sender_config_page = QWidget()
        as_sender_config_layout = QVBoxLayout(as_sender_config_page)
        self.as_sender_accounts_group = QGroupBox("Apps Script Sender Accounts (Select to Use)") # Renamed
        as_sender_group_layout = QVBoxLayout(self.as_sender_accounts_group)
        self.sender_accounts_list_widget_as_ref = QListWidget() # Renamed
        self.sender_accounts_list_widget_as_ref.setObjectName("SenderAccountsListAS")
        self.sender_accounts_list_widget_as_ref.setToolTip("Check one or more configured Apps Script accounts to use for sending. Selected accounts will be rotated for load balancing.")
        self.sender_accounts_list_widget_as_ref.setSelectionMode(QAbstractItemView.MultiSelection)
        as_sender_group_layout.addWidget(self.sender_accounts_list_widget_as_ref)
        manage_as_accounts_button = QPushButton(QIcon.fromTheme("preferences-system"), "🔧 Manage Apps Script Accounts")
        manage_as_accounts_button.clicked.connect(self.show_manage_as_accounts_dialog)
        as_sender_group_layout.addWidget(manage_as_accounts_button)
        as_sender_config_layout.addWidget(self.as_sender_accounts_group)
        self.sender_config_stacked_widget.addWidget(as_sender_config_page)

        # Generic SMTP sender configuration page
        generic_smtp_sender_config_page = QWidget()
        generic_smtp_sender_config_layout = QVBoxLayout(generic_smtp_sender_config_page)
        self.generic_smtp_sender_accounts_group = QGroupBox("Generic SMTP Servers (Select to Use)") # Renamed
        generic_smtp_group_layout = QVBoxLayout(self.generic_smtp_sender_accounts_group)
        self.sender_accounts_list_widget_generic_smtp_ref = QListWidget() # <--- ASSIGNED HERE
        self.sender_accounts_list_widget_generic_smtp_ref.setToolTip("Check one or more configured Generic SMTP servers. Emails will be distributed among selected servers, respecting their individual rate limits.")
        self.sender_accounts_list_widget_generic_smtp_ref.setSelectionMode(QAbstractItemView.MultiSelection)
        generic_smtp_group_layout.addWidget(self.sender_accounts_list_widget_generic_smtp_ref)
        
        smtp_manage_buttons_layout = QHBoxLayout()
        manage_generic_smtp_button = QPushButton(QIcon.fromTheme("preferences-system"), "🔧 Manage SMTP Servers")
        manage_generic_smtp_button.clicked.connect(self.show_manage_generic_smtp_servers_dialog)
        refresh_generic_smtp_list_button = QPushButton(QIcon.fromTheme("view-refresh"), "🔄 Refresh Server List")
        refresh_generic_smtp_list_button.clicked.connect(self.load_configured_generic_smtp_servers) # Populates the list
        smtp_manage_buttons_layout.addWidget(manage_generic_smtp_button)
        smtp_manage_buttons_layout.addWidget(refresh_generic_smtp_list_button)
        smtp_manage_buttons_layout.addStretch()
        
        generic_smtp_group_layout.addLayout(smtp_manage_buttons_layout)
        generic_smtp_sender_config_layout.addWidget(self.generic_smtp_sender_accounts_group)
        self.sender_config_stacked_widget.addWidget(generic_smtp_sender_config_page)

        # Recipients Group
        recipients_config_group = QGroupBox("2. Recipients Configuration")
        recipients_config_main_layout = QVBoxLayout(recipients_config_group)
        recipients_form_sub_layout = QFormLayout()
        self.to_field_input = QLineEdit() # Renamed
        self.to_field_input.setPlaceholderText("Single: user1@ex.com, user2@ex.com | Bulk: {{email_column_header}} (from data source)")
        self.to_field_input.setToolTip("Enter recipient email(s). For bulk sending with a data source (CSV/Excel/GSheet), use a placeholder like {{email_header}} corresponding to a column in your data.\nMultiple direct emails can be comma-separated.")
        recipients_form_sub_layout.addRow("To:", self.to_field_input)
        recipients_config_main_layout.addLayout(recipients_form_sub_layout)
        compose_left_pane_layout.addWidget(recipients_config_group)

        # Test Email Configuration Group
        test_email_config_group = QGroupBox("🧪 Test Email Configuration (Optional)")
        test_email_config_form_layout = QFormLayout(test_email_config_group)
        self.test_email_address_input_field = QLineEdit()
        self.test_email_address_input_field.setPlaceholderText("e.g., my_test_account@example.com")
        self.test_email_address_input_field.setToolTip("If filled, a test email (based on the current campaign content) will be sent to this address periodically.")
        test_email_config_form_layout.addRow("Test Email Address:", self.test_email_address_input_field)
        
        self.test_after_x_emails_spinbox_ref = QSpinBox()
        self.test_after_x_emails_spinbox_ref.setRange(0, 100000) # 0 means disabled
        self.test_after_x_emails_spinbox_ref.setValue(self.test_email_trigger_count)
        self.test_after_x_emails_spinbox_ref.setToolTip("Send a test email after this many primary emails have been successfully sent. Set to 0 to disable automatic periodic testing.")
        test_email_config_form_layout.addRow("Send Test After Every X Emails:", self.test_after_x_emails_spinbox_ref)
        compose_left_pane_layout.addWidget(test_email_config_group)
        compose_left_pane_layout.addStretch(1)

        # Right Pane: Data Source, Monitor, Log
        compose_right_pane_widget = QWidget()
        compose_right_pane_layout = QVBoxLayout(compose_right_pane_widget)
        compose_right_pane_layout.setSpacing(8)
        self.compose_tab_horizontal_splitter.addWidget(compose_right_pane_widget)

        # Data Source Group
        self.bulk_data_source_group = QGroupBox("3. Bulk Send Data Source (Optional)") # Renamed
        data_list_group_layout = QVBoxLayout(self.bulk_data_source_group)
        data_source_controls_sub_layout = QHBoxLayout()
        data_source_controls_sub_layout.addWidget(QLabel("Source Type:"))
        self.data_source_type_combo = QComboBox() # Renamed
        self.data_source_type_combo.addItems(["Paste CSV Data", "Load from Excel File", "Load from Google Sheet URL"])
        self.data_source_type_combo.currentIndexChanged.connect(self.on_data_source_type_changed)
        data_source_controls_sub_layout.addWidget(self.data_source_type_combo, 1)
        data_list_group_layout.addLayout(data_source_controls_sub_layout)

        self.data_source_stacked_widget = QStackedWidget() # Renamed
        data_list_group_layout.addWidget(self.data_source_stacked_widget)

        # Paste CSV data page
        paste_csv_data_page = QWidget()
        paste_csv_data_layout = QVBoxLayout(paste_csv_data_page)
        self.csv_data_paste_area = QTextEdit() # Renamed
        self.csv_data_paste_area.setPlaceholderText("Paste CSV data here. First line MUST be headers.\nExample:\nemail,firstname,product_name\njohn.doe@example.com,John,WidgetA\njane.smith@example.com,Jane,WidgetB")
        self.csv_data_paste_area.setToolTip("Paste CSV formatted data. The first line is treated as headers for placeholders like {{firstname}} or {{product_name}}.")
        paste_csv_data_layout.addWidget(self.csv_data_paste_area)
        self.data_source_stacked_widget.addWidget(paste_csv_data_page)

        # Excel file load page
        excel_file_load_page = QWidget()
        excel_file_load_layout = QVBoxLayout(excel_file_load_page)
        excel_loader_sub_layout = QHBoxLayout()
        self.load_excel_file_button = QPushButton(QIcon.fromTheme("document-open"), "📁 Load Excel File") # Renamed
        self.load_excel_file_button.clicked.connect(self.trigger_load_excel_file_dialog)
        excel_loader_sub_layout.addWidget(self.load_excel_file_button)
        self.excel_file_status_label = QLabel("No Excel file loaded.") # Renamed
        self.excel_file_status_label.setWordWrap(True)
        excel_loader_sub_layout.addWidget(self.excel_file_status_label, 1)
        excel_file_load_layout.addLayout(excel_loader_sub_layout)
        excel_file_load_layout.addStretch(1) 
        self.data_source_stacked_widget.addWidget(excel_file_load_page)

        # Google Sheet load page
        google_sheet_load_page = QWidget()
        google_sheet_load_layout = QVBoxLayout(google_sheet_load_page)
        gsheet_url_input_sub_layout = QHBoxLayout()
        self.google_sheet_url_field = QLineEdit() # Renamed
        self.google_sheet_url_field.setPlaceholderText("Paste public Google Sheet URL (ensure Apps Script can access it)")
        gsheet_url_input_sub_layout.addWidget(self.google_sheet_url_field, 1)
        self.fetch_google_sheet_data_button = QPushButton(QIcon.fromTheme("download"), "🌐 Fetch GSheet Data") # Renamed
        self.fetch_google_sheet_data_button.clicked.connect(self.trigger_load_google_sheet_data)
        gsheet_url_input_sub_layout.addWidget(self.fetch_google_sheet_data_button)
        google_sheet_load_layout.addLayout(gsheet_url_input_sub_layout)
        self.google_sheet_status_label = QLabel("No Google Sheet data loaded.") # Renamed
        self.google_sheet_status_label.setWordWrap(True)
        google_sheet_load_layout.addWidget(self.google_sheet_status_label)
        google_sheet_load_layout.addStretch(1) 
        self.data_source_stacked_widget.addWidget(google_sheet_load_page)

        self.data_list_placeholder_instruction_label = QLabel("Use placeholders like <b>{{HeaderNameFromData}}</b> in 'To', 'Subject', 'Body', and 'Custom Headers' to insert data from the loaded source. Header names from your data are case-insensitive for placeholders, and spaces are treated as underscores (e.g., 'First Name' becomes {{first_name}} or {{FirstName}}).")
        self.data_list_placeholder_instruction_label.setTextFormat(Qt.RichText)
        self.data_list_placeholder_instruction_label.setWordWrap(True)
        data_list_group_layout.addWidget(self.data_list_placeholder_instruction_label)
        compose_right_pane_layout.addWidget(self.bulk_data_source_group)

        # Performance Monitor Group
        performance_monitor_display_group = QGroupBox("📊 Live Performance Monitor")
        performance_monitor_layout = QVBoxLayout(performance_monitor_display_group)
        self.performance_stats_display_label = QLabel("Ready to send. Queue: 0 emails.") # Renamed
        self.performance_stats_display_label.setStyleSheet("font-family: 'Courier New', Courier, monospace; font-size: 10pt; background-color: #f0f0f0; padding: 5px; border-radius: 3px;") 
        self.performance_stats_display_label.setMinimumHeight(70) # Ensure enough space
        self.performance_stats_display_label.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        performance_monitor_layout.addWidget(self.performance_stats_display_label)
        compose_right_pane_layout.addWidget(performance_monitor_display_group)

        # Log Group
        send_log_display_group = QGroupBox("📜 Send Log & Progress") # Renamed
        send_log_layout = QVBoxLayout(send_log_display_group)
        self.send_log_text_area = QTextEdit() # Renamed
        self.send_log_text_area.setReadOnly(True)
        self.send_log_text_area.setLineWrapMode(QTextEdit.WidgetWidth)
        self.send_log_text_area.setMaximumHeight(280) # Increased height
        send_log_layout.addWidget(self.send_log_text_area)
        
        self.overall_progress_bar = QProgressBar() # Renamed
        self.overall_progress_bar.setTextVisible(True)
        self.overall_progress_bar.setRange(0, 100)
        self.overall_progress_bar.setValue(0)
        self.overall_progress_bar.setFormat("%p% - Ready")
        send_log_layout.addWidget(self.overall_progress_bar)
        
        compose_right_pane_layout.addWidget(send_log_display_group)
        self.compose_tab_horizontal_splitter.setSizes([480, 520]) # Initial sizes

        self.main_tab_widget.addTab(compose_tab_widget, QIcon.fromTheme("document-send"), "🚀 Campaign Setup & Control")

        # --- Tab 2: Email Content Creation ---
        self.email_content_creation_tab = QWidget() # Renamed
        content_tab_main_layout = QVBoxLayout(self.email_content_creation_tab)

        from_name_config_group = QGroupBox("Sender Display Name(s) (Rotated per Email if Multiple)")
        from_name_layout = QVBoxLayout(from_name_config_group)
        self.from_name_text_editor = QTextEdit() # Renamed
        self.from_name_text_editor.setPlaceholderText("Enter one 'From Name' per line for rotation if multiple are provided.\nE.g., Sales Team\nSupport @ MyCompany\n{{customer_rep_name}} (if using data source placeholders)")
        self.from_name_text_editor.setMaximumHeight(100)
        from_name_layout.addWidget(self.from_name_text_editor)
        content_tab_main_layout.addWidget(from_name_config_group)

        subject_lines_group = QGroupBox("Subject Line(s) (Rotated per Email if Multiple)")
        subject_layout = QVBoxLayout(subject_lines_group)
        self.subject_lines_text_editor = QTextEdit() # Renamed
        self.subject_lines_text_editor.setPlaceholderText("Enter one subject per line for rotation.\nE.g., {{firstname}}, an update for you regarding {{order_id}}!\nSpecial Offer Just For You on {{product_name}}\nRegarding your inquiry")
        self.subject_lines_text_editor.setMaximumHeight(120)
        subject_layout.addWidget(self.subject_lines_text_editor)
        content_tab_main_layout.addWidget(subject_lines_group)

        email_body_group = QGroupBox("Email Body Content")
        email_body_layout = QVBoxLayout(email_body_group)
        body_format_selection_layout = QHBoxLayout()
        body_format_selection_layout.addWidget(QLabel("Body Format:"))
        self.body_format_type_combo = QComboBox() # Renamed
        self.body_format_type_combo.addItems(["Rich Text (Compose in editor)", "Raw HTML Source", "Plain Text Source"])
        self.body_format_type_combo.currentIndexChanged.connect(self.on_body_format_type_changed)
        body_format_selection_layout.addWidget(self.body_format_type_combo, 1)
        email_body_layout.addLayout(body_format_selection_layout)
        
        self.email_body_text_input = QTextEdit() # Renamed
        self.email_body_text_input.setPlaceholderText("Compose your email message here. Use {{placeholders}} like {{name}} from your data source, or dynamic tags like {{[date]}} or {{[rnd]}} (see Tags Guide). Spintax {option1|option2} is also supported.")
        self.email_body_text_input.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        email_body_layout.addWidget(self.email_body_text_input)
        content_tab_main_layout.addWidget(email_body_group)

        custom_headers_config_group = QGroupBox("Custom Email Headers (Advanced Users)")
        custom_headers_layout = QVBoxLayout(custom_headers_config_group)
        self.enable_custom_headers_checkbox = QCheckBox("Enable Custom Headers") # Renamed
        self.enable_custom_headers_checkbox.setToolTip("Allows overriding or adding email headers like 'Reply-To', 'List-Unsubscribe'.\nUsing 'To:', 'Subject:', or 'From:' here will OVERRIDE the main UI fields if specified. Use with caution.")
        self.enable_custom_headers_checkbox.toggled.connect(self.on_enable_custom_headers_toggled)
        custom_headers_layout.addWidget(self.enable_custom_headers_checkbox)
        
        self.custom_headers_text_input = QTextEdit() # Renamed
        self.custom_headers_text_input.setPlaceholderText("Header-Name: Header-Value (one per line)\nExample:\nReply-To: support@example.com\nList-Unsubscribe: <mailto:unsubscribe@example.com?subject=unsubscribe>, <{{unsubscribe_link_placeholder}}>\nTo: {{contact_email_from_data}}\nSubject: Your Custom Subject with {{data_field}}")
        self.custom_headers_text_input.setMaximumHeight(150)
        self.custom_headers_text_input.setEnabled(False) # Disabled by default
        custom_headers_layout.addWidget(self.custom_headers_text_input)
        content_tab_main_layout.addWidget(custom_headers_config_group)

        self.main_tab_widget.addTab(self.email_content_creation_tab, QIcon.fromTheme("mail-compose"), "✍️ Email Content Creation")

        # --- Tab 3: AI Tools ---
        self.ai_tools_suite_tab = QWidget() # Renamed
        ai_tools_layout = QVBoxLayout(self.ai_tools_suite_tab)
        
        gemini_api_setup_group = QGroupBox("Google Gemini API Setup")
        gemini_setup_form = QFormLayout(gemini_api_setup_group)
        self.gemini_api_key_input_field = QLineEdit() # Renamed
        self.gemini_api_key_input_field.setPlaceholderText("Enter your Google Gemini API Key here")
        self.gemini_api_key_input_field.setEchoMode(QLineEdit.Password)
        self.gemini_api_key_input_field.editingFinished.connect(self.on_gemini_api_key_changed_save)
        gemini_setup_form.addRow("Gemini API Key:", self.gemini_api_key_input_field)
        
        get_gemini_key_button = QPushButton(QIcon.fromTheme("go-network"), "🔑 Get Gemini API Key (Google AI Studio)")
        get_gemini_key_button.clicked.connect(lambda: QDesktopServices.openUrl(QUrl("https://aistudio.google.com/app/apikey")))
        gemini_setup_form.addRow(get_gemini_key_button)
        ai_tools_layout.addWidget(gemini_api_setup_group)

        subject_generation_group = QGroupBox("🤖 Generate Subject Line Variations with Gemini")
        subject_gen_layout = QVBoxLayout(subject_generation_group)
        subject_gen_form = QFormLayout()
        self.base_subject_idea_field = QLineEdit() # Renamed
        self.base_subject_idea_field.setPlaceholderText("E.g., New product launch for {{company}}, Summer sale on {{category}}, Follow-up on quote #{{quote_id}}")
        self.base_subject_idea_field.setToolTip("Enter your base subject idea, keywords, or even a full subject. You can use placeholders from your data source.")
        subject_gen_form.addRow("Base Idea/Keywords:", self.base_subject_idea_field)
        
        self.num_subjects_to_gen_spinbox = QSpinBox() # Renamed
        self.num_subjects_to_gen_spinbox.setRange(1, 25) # Increased max
        self.num_subjects_to_gen_spinbox.setValue(5)
        subject_gen_form.addRow("Number of Variations to Generate:", self.num_subjects_to_gen_spinbox)
        subject_gen_layout.addLayout(subject_gen_form)
        
        self.generate_ai_subjects_button = QPushButton(QIcon.fromTheme("system-run"), "🤖 Generate Subjects with AI") # Renamed
        self.generate_ai_subjects_button.clicked.connect(self.trigger_gemini_subject_generation)
        subject_gen_layout.addWidget(self.generate_ai_subjects_button)
        
        self.generated_subjects_display_list = QListWidget() # Renamed
        self.generated_subjects_display_list.setToolTip("Double-click a generated subject to add it to the main subject editor on the 'Email Content' tab.")
        self.generated_subjects_display_list.itemDoubleClicked.connect(self.on_generated_subject_double_clicked_add_to_editor)
        subject_gen_layout.addWidget(QLabel("Generated Subject Suggestions (Double-click to use):"))
        subject_gen_layout.addWidget(self.generated_subjects_display_list)
        ai_tools_layout.addWidget(subject_generation_group)
        ai_tools_layout.addStretch(1)

        self.main_tab_widget.addTab(self.ai_tools_suite_tab, QIcon.fromTheme("applications-education"), "🤖 AI Subject Helper")

        # --- Action Buttons Bar ---
        # This bar contains primary controls for preparing and sending the campaign.
        # "Add to Queue" prepares the campaign. "Start" sends the prepared campaign.
        action_buttons_control_widget = QWidget() 
        action_buttons_layout = QHBoxLayout(action_buttons_control_widget)
        action_buttons_layout.setContentsMargins(0, 8, 0, 0) # Top margin
        
        self.clear_all_fields_button = QPushButton(QIcon.fromTheme("edit-clear"), "🗑️ Clear All Input Fields")
        self.clear_all_fields_button.setToolTip("Clears all input fields across tabs (recipients, content, data sources). Does not clear the processing queue or logs.")
        self.clear_all_fields_button.clicked.connect(lambda: self.clear_all_compose_fields_ui(confirm=True))
        action_buttons_layout.addWidget(self.clear_all_fields_button)
        
        self.prepare_campaign_add_to_queue_button = QPushButton(QIcon.fromTheme("document-new"), "➕ Prepare Campaign & Add to Queue")
        self.prepare_campaign_add_to_queue_button.setToolTip("Processes all inputs (recipients, content, data) to prepare the full email campaign and adds it to the processing queue. This is the main preparation step.")
        self.prepare_campaign_add_to_queue_button.clicked.connect(self.action_prepare_campaign_and_add_to_queue)
        action_buttons_layout.addWidget(self.prepare_campaign_add_to_queue_button)
        
        action_buttons_layout.addStretch(1) 
        
        self.start_sending_queue_button = QPushButton(QIcon.fromTheme("media-playback-start"), "🚀 Start Sending Prepared Campaign")
        self.start_sending_queue_button.setToolTip("Starts sending all emails currently in the prepared processing queue.")
        self.start_sending_queue_button.clicked.connect(self.action_start_queue_processing)
        action_buttons_layout.addWidget(self.start_sending_queue_button)
        
        self.pause_resume_sending_button = QPushButton(QIcon.fromTheme("media-playback-pause"), "⏸️ Pause Sending")
        self.pause_resume_sending_button.setToolTip("Pauses or resumes the current email sending process. Active batches will complete if paused.")
        self.pause_resume_sending_button.clicked.connect(self.action_toggle_pause_resume_queue)
        action_buttons_layout.addWidget(self.pause_resume_sending_button)
        
        self.stop_sending_clear_queue_button = QPushButton(QIcon.fromTheme("media-playback-stop"), "🛑 Stop Sending & Clear Queue")
        self.stop_sending_clear_queue_button.setToolTip("Stops the current sending process immediately and clears all pending emails from the processing queue.")
        self.stop_sending_clear_queue_button.clicked.connect(self.action_stop_queue_processing_and_clear)
        action_buttons_layout.addWidget(self.stop_sending_clear_queue_button)
        
        main_app_layout.addWidget(action_buttons_control_widget)

        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("⚡ High-Speed Mailer Ready - Configure sending method, accounts, and content.")

        # Performance update timer for UI display
        self.live_performance_update_timer = QTimer(self)
        self.live_performance_update_timer.timeout.connect(self.refresh_performance_stats_display)
        self.live_performance_update_timer.start(1000)  # Update every second

        # Initialize UI states based on current logic
        self.update_queue_control_buttons_state()
        self.on_body_format_type_changed() 
        self.on_data_source_type_changed()
        self.on_enable_custom_headers_toggled(self.enable_custom_headers_checkbox.isChecked())
        self.on_send_method_changed_update_visibility() 


    def _create_main_toolbar(self):
        main_toolbar = QToolBar("Main Toolbar")
        main_toolbar.setIconSize(QSize(24, 24)) # Slightly larger icons
        self.addToolBar(Qt.TopToolBarArea, main_toolbar)

        show_tags_guide_action = QAction(QIcon.fromTheme("help-contextual", QIcon(":/icons/tags_icon.png")), "🏷️ Usable Tags Guide", self)
        show_tags_guide_action.setToolTip("Show a guide of available dynamic tags for personalizing email content.")
        show_tags_guide_action.triggered.connect(self.show_dynamic_tags_guide_dialog)
        main_toolbar.addAction(show_tags_guide_action)

    def show_dynamic_tags_guide_dialog(self):
        if self.tags_dialog_instance is None or not self.tags_dialog_instance.isVisible():
            self.tags_dialog_instance = TagsDialog(self) # Parent to main window
        self.tags_dialog_instance.show()
        self.tags_dialog_instance.raise_() 
        self.tags_dialog_instance.activateWindow()

    def _create_main_menu_bar(self):
        menu_bar = self.menuBar()
        file_menu = menu_bar.addMenu("&File")
        # Add actions like "Save Campaign Setup", "Load Campaign Setup" in future if needed
        file_menu.addSeparator()
        file_menu.addAction(self.app_exit_action) # Defined in _create_main_actions
        
        # View Menu (for themes, etc.) - Can be expanded
        view_menu = menu_bar.addMenu("&View")
        theme_menu = view_menu.addMenu("Themes")
        yahoo_theme_action = QAction("Yahoo Style", self, checkable=True)
        yahoo_theme_action.triggered.connect(lambda: self.apply_stylesheet("yahoo"))
        theme_menu.addAction(yahoo_theme_action)
        # Add more themes here... default_theme_action = QAction("Default Qt Style", self, checkable=True)...

        # Tools Menu (for global settings, proxy settings etc.)
        tools_menu = menu_bar.addMenu("&Tools")
        # Example: proxy_settings_action = QAction("Proxy Settings...", self)
        # tools_menu.addAction(proxy_settings_action) # Connect to a proxy settings dialog

        help_menu = menu_bar.addMenu("&Help")
        tags_guide_menu_action = QAction("Usable Tags Guide", self)
        tags_guide_menu_action.triggered.connect(self.show_dynamic_tags_guide_dialog)
        help_menu.addAction(tags_guide_menu_action)
        # about_action = QAction("About...", self)
        # help_menu.addAction(about_action) # Connect to an About dialog


    def _create_main_actions(self):
        self.app_exit_action = QAction(QIcon.fromTheme("application-exit"), "&Exit Application", self)
        self.app_exit_action.setShortcut(QKeySequence.Quit)
        self.app_exit_action.setStatusTip("Exit the High-Speed Email Mailer application.")
        self.app_exit_action.triggered.connect(self.close) # QMainWindow.close triggers closeEvent

    def apply_stylesheet(self, theme_name="yahoo"): 
        if theme_name == "yahoo":
            # Yahoo-inspired stylesheet (as provided in original script)
            # Minor adjustments for potentially new widget names if any were made.
            stylesheet = """
                QMainWindow, QDialog {
                    background-color: #f4f3f8; color: #333333;
                    font-family: "Segoe UI", Arial, sans-serif; 
                }
                QGroupBox {
                    font-weight: bold; border: 2px solid #7828A8; /* Yahoo Purple */
                    border-radius: 8px; margin-top: 12px; padding: 12px;
                    background-color: #ffffff; /* White background for group content */
                }
                QGroupBox::title {
                    subcontrol-origin: margin; subcontrol-position: top left;
                    padding: 0 8px; left: 10px; color: #400090; /* Darker Yahoo Purple */
                    font-size: 11pt; font-weight: bold;
                }
                QLabel { font-size: 10pt; color: #333333; padding: 2px; }
                QLineEdit, QTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {
                    border: 1px solid #c0c0c0; border-radius: 5px; padding: 7px; 
                    background-color: #ffffff; font-size: 10pt; color: #222222;
                }
                QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus, QDoubleSpinBox:focus {
                    border: 2px solid #7828A8; /* Purple border on focus */
                }
                QPushButton {
                    background-color: #7828A8; color: #ffffff; border: none;
                    border-radius: 6px; padding: 10px 20px; font-size: 10pt;
                    font-weight: bold; min-width: 120px;
                }
                QPushButton:hover { background-color: #5F0F68; /* Darker purple on hover */ }
                QPushButton:pressed { background-color: #400090; /* Even darker on press */ }
                QListWidget {
                    border: 1px solid #c0c0c0; border-radius: 5px; background-color: #ffffff;
                    font-size: 10pt; alternate-background-color: #f9f9f9; 
                }
                QListWidget::item:selected {
                    background-color: #7828A8; color: #ffffff; border-radius: 3px; 
                }
                QListWidget::item { padding: 4px; } /* Increased padding for readability */
                QTextEdit#send_log_text_area { /* Assuming send_log_text_area is objectName */
                    background-color: #2e2e2e; color: #d0d0d0; border: 1px solid #404040;
                    font-family: "Consolas", "Courier New", monospace; font-size: 9pt;
                    border-radius: 5px;
                }
                QStatusBar {
                    font-size: 9pt; color: #333333; background-color: #e8e8e8;
                    border-top: 1px solid #cccccc;
                }
                QProgressBar {
                    border: 1px solid #b0b0b0; border-radius: 5px; text-align: center;
                    font-size: 9pt; height: 24px; color: #ffffff; background-color: #e0e0e0;
                }
                QProgressBar::chunk {
                    background-color: #7828A8; border-radius: 4px;
                }
                QTabWidget#MainTabWidget::pane { /* Target MainTabWidget specifically */
                    border: 2px solid #7828A8; border-top: none; background: #ffffff;
                    padding: 10px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;
                }
                QTabWidget#MainTabWidget QTabBar::tab {
                    background: #e8e8e8; border: 1px solid #d1d1d1; border-bottom: none;
                    border-top-left-radius: 6px; border-top-right-radius: 6px;
                    min-width: 180px; /* Wider tabs */ padding: 12px 18px; 
                    font-size: 10pt; color: #555555; margin-right: 2px;
                }
                QTabWidget#MainTabWidget QTabBar::tab:selected {
                    background: #ffffff; color: #400090; font-weight: bold;
                    border-bottom: 1px solid #ffffff; /* Blend with pane */
                }
                QTabWidget#MainTabWidget QTabBar::tab:hover:!selected {
                    background: #f0f0f0; color: #333333; 
                }
                QCheckBox::indicator { width: 16px; height: 16px; border-radius: 3px;}
                QCheckBox::indicator:unchecked { background-color: #f0f0f0; border: 1px solid #c0c0c0; }
                QCheckBox::indicator:checked { background-color: #7828A8; border: 1px solid #400090; }
                QSplitter::handle { background-color: #d0d0d0; }
                QSplitter::handle:horizontal { width: 4px; } /* Thicker splitter */
                QSplitter::handle:vertical { height: 4px; }
                QSplitter::handle:pressed { background-color: #7828A8; }
                QScrollArea { border: none; }
            """
            # Set object names for QTextEdit if specific styling needed
            if hasattr(self, 'send_log_text_area'): self.send_log_text_area.setObjectName("send_log_text_area")
            self.setStyleSheet(stylesheet)
        else: # For other themes or default Qt style
            self.setStyleSheet("") 
        
        self.current_theme = theme_name
        self.settings.setValue("theme", self.current_theme)
        # Update theme selection in menu
        # ... (logic to check the correct theme action in View > Themes menu) ...

    # --- Core Email Processing Control Functions ---
    def on_max_concurrent_sends_changed(self, value):
        self.max_concurrent_sends_per_batch_worker = value
        self.settings.setValue(MAX_CONCURRENT_SENDS_SETTING, self.max_concurrent_sends_per_batch_worker)
        self.status_bar.showMessage(f"⚡ Max concurrent sends (per batch worker) set to {self.max_concurrent_sends_per_batch_worker}", 3000)

    def on_batch_size_changed(self, value):
        self.batch_size_for_main_workers = value
        self.settings.setValue("batch_size", self.batch_size_for_main_workers) # Ensure "batch_size" is used as key
        self.status_bar.showMessage(f"📦 Main batch size (emails per worker) set to {self.batch_size_for_main_workers}", 3000)

    def refresh_performance_stats_display(self):
        """Update the live performance statistics display label."""
        if self.queue_processing_active and self.overall_processing_start_time > 0:
            elapsed_seconds = time.time() - self.overall_processing_start_time
            if elapsed_seconds > 0.01:
                emails_per_sec = self.total_emails_processed_overall / elapsed_seconds
                success_rate = (self.total_emails_successful_overall / max(self.total_emails_processed_overall, 1)) * 100
                
                pending_in_queue = len(self.email_job_queue) - self.total_emails_processed_overall
                pending_in_queue = max(0, pending_in_queue) # Ensure not negative

                stats_text = (f"<b>⚡ Processing Campaign:</b>\n"
                              f"  Processed: {self.total_emails_processed_overall} / {len(self.email_job_queue)} (Pending: {pending_in_queue})\n"
                              f"  Current Speed: {emails_per_sec:.1f} emails/sec\n"
                              f"  Success Rate: {success_rate:.1f}% ({self.total_emails_successful_overall} successful)\n"
                              f"  Active Batch Workers: {len(self.active_batch_send_workers)}\n"
                              f"  Elapsed Time: {int(elapsed_seconds // 3600):02d}h:{int((elapsed_seconds // 60) % 60):02d}m:{int(elapsed_seconds % 60):02d}s")
                self.performance_stats_display_label.setText(stats_text)
            else:
                self.performance_stats_display_label.setText("<b>⚡ Processing Campaign:</b> Starting up...")

        elif not self.queue_processing_active and self.total_emails_processed_overall > 0: # Show final stats if stopped/finished
             elapsed_seconds = self.overall_processing_end_time - self.overall_processing_start_time if hasattr(self, 'overall_processing_end_time') and self.overall_processing_start_time > 0 else 0
             emails_per_sec = self.total_emails_processed_overall / elapsed_seconds if elapsed_seconds > 0.01 else 0
             success_rate = (self.total_emails_successful_overall / max(self.total_emails_processed_overall, 1)) * 100
             
             stats_text = (f"<b>🏁 Campaign Finished:</b>\n"
                           f"  Total Processed: {self.total_emails_processed_overall}\n"
                           f"  Average Speed: {emails_per_sec:.1f} emails/sec\n"
                           f"  Overall Success: {success_rate:.1f}% ({self.total_emails_successful_overall} successful)\n"
                           f"  Total Time: {int(elapsed_seconds // 3600):02d}h:{int((elapsed_seconds // 60) % 60):02d}m:{int(elapsed_seconds % 60):02d}s")
             self.performance_stats_display_label.setText(stats_text)
        else: # Idle state
            self.performance_stats_display_label.setText(f"<b>Ready to send.</b>\n  Prepared Queue: {len(self.email_job_queue)} emails.")


    def action_start_queue_processing(self):
        """Initiates high-speed processing of the prepared email campaign queue."""
        if not self.email_job_queue: # Queue of prepared jobs
            QMessageBox.information(self, "Queue Empty", "The email campaign queue is empty. Please prepare the campaign first using 'Prepare Campaign & Add to Queue'.")
            return
        
        if self.queue_processing_active and not self.is_paused_flag:
            QMessageBox.information(self, "Processing Active", "The campaign processing is already running. You can pause or stop it.")
            return

        # Validate selected sender configuration before starting
        send_method_str = self.send_via_combo_box.currentText()
        if "Apps Script" in send_method_str and not self.get_selected_as_accounts_from_ui():
            QMessageBox.warning(self, "Configuration Error", "No Apps Script accounts are selected. Please select at least one from the list or manage accounts.")
            return
        elif "Generic SMTP" in send_method_str and not self.get_selected_generic_smtp_servers_from_ui():
            QMessageBox.warning(self, "Configuration Error", "No Generic SMTP servers are selected. Please select at least one or manage servers.")
            return
        
        # Initialize/reset performance tracking if starting from the beginning of the queue
        self.queue_processing_active = True
        self.is_paused_flag = False
        if self.current_job_index_for_dispatch == 0: # Fresh start or restart from beginning
            self.overall_processing_start_time = time.time()
            self.total_emails_processed_overall = 0
            self.total_emails_successful_overall = 0
        self.primary_emails_sent_since_last_test = 0 # Always reset test counter on start/resume

        self.pause_resume_sending_button.setText("⏸️ Pause Sending")
        self.pause_resume_sending_button.setIcon(QIcon.fromTheme("media-playback-pause"))
        self.status_bar.showMessage("🚀 Starting high-speed email campaign processing...", 5000)
        self.append_message_to_log_area("<br><b style='color: #400090;'>--- 🚀 STARTING HIGH-SPEED EMAIL CAMPAIGN PROCESSING ---</b>")

        # If restarting a completed/stopped queue, reset dispatch index
        if self.current_job_index_for_dispatch >= len(self.email_job_queue):
            self.current_job_index_for_dispatch = 0
            # Note: Jobs in self.email_job_queue are already prepared. No need to re-prepare.

        self.update_queue_control_buttons_state()
        self.dispatch_next_email_batch_to_worker() # Start dispatching batches

    def dispatch_next_email_batch_to_worker(self):
        """Dispatches the next batch of prepared emails from the main queue to a new OptimizedEmailSenderThread."""
        if self.is_paused_flag or not self.queue_processing_active:
            if self.is_paused_flag: print("Dispatch Next Batch: Paused, not starting new batch worker.")
            if not self.queue_processing_active: print("Dispatch Next Batch: Queue processing not active, not starting new batch worker.")
            return
        
        # Check if all jobs from the main queue have been dispatched to workers
        if self.current_job_index_for_dispatch >= len(self.email_job_queue):
            if not self.active_batch_send_workers: # All dispatched AND all workers finished
                self.finalize_overall_queue_processing()
            else: # All dispatched, but some workers still busy
                print(f"Dispatch Next Batch: All jobs dispatched ({self.current_job_index_for_dispatch}), but {len(self.active_batch_send_workers)} batch workers still active. Waiting for them to finish.")
            return

        # Determine the slice of jobs for the next batch worker
        batch_start_idx = self.current_job_index_for_dispatch
        batch_end_idx = min(batch_start_idx + self.batch_size_for_main_workers, len(self.email_job_queue))
        current_batch_of_prepared_jobs = self.email_job_queue[batch_start_idx:batch_end_idx]
        
        if not current_batch_of_prepared_jobs: # Should ideally not happen if above checks are correct
            if not self.active_batch_send_workers: self.finalize_overall_queue_processing()
            return

        # Configuration for the OptimizedEmailSenderThread instance
        sender_config_for_this_batch_worker = {
            'max_concurrent_tasks_in_batch': self.max_concurrent_sends_per_batch_worker, 
            'proxy_dict': self.get_active_proxy_config_dict() # Get current proxy settings
        }

        # Create and start a new worker thread for this batch
        batch_worker = OptimizedEmailSenderThread(
            current_batch_of_prepared_jobs, 
            sender_config_for_this_batch_worker, 
            self.rate_limiters_pool # Pass the central pool of rate limiters
        )
        batch_worker.setObjectName(f"BatchWorker-{batch_start_idx // self.batch_size_for_main_workers + 1}") 

        # Connect signals from the batch worker
        batch_worker.send_status_signal.connect(self.update_status_bar_message_from_thread)
        batch_worker.progress_update_signal.connect(self.update_overall_progress_bar_display) # Batch worker's internal progress
        batch_worker.batch_progress_signal.connect(self.handle_batch_worker_progress_update) # Detailed progress from batch
        batch_worker.send_finished_signal.connect(self.on_batch_worker_finished)
        batch_worker.primary_email_sent_successfully.connect(self.on_primary_email_success_trigger_test)
        
        self.active_batch_send_workers.append(batch_worker)
        batch_worker.start() # Start the thread
        
        num_jobs_in_this_batch = len(current_batch_of_prepared_jobs)
        self.append_message_to_log_area(f"🚀 Worker {batch_worker.objectName()} dispatched for batch of {num_jobs_in_this_batch} emails (Jobs {batch_start_idx + 1}-{batch_end_idx} of {len(self.email_job_queue)})")
        
        self.current_job_index_for_dispatch = batch_end_idx # Advance pointer for the next batch
        self.update_queue_control_buttons_state()


    def on_primary_email_success_trigger_test(self, successfully_sent_job_config):
        """Called by a worker when a primary (non-test) email is successfully sent. Triggers a test email if conditions met."""
        self.primary_emails_sent_since_last_test += 1
        
        target_test_address = self.test_email_address_input_field.text().strip()
        trigger_after_count = self.test_after_x_emails_spinbox_ref.value()
        
        if target_test_address and "@" in target_test_address and \
           trigger_after_count > 0 and \
           self.primary_emails_sent_since_last_test >= trigger_after_count:
            
            self.primary_emails_sent_since_last_test = 0 # Reset counter
            print(f"Auto-Test Trigger: Conditions met for test email to {target_test_address} based on successful job: {successfully_sent_job_config.get('job_id', 'N/A')}")
            self.dispatch_single_test_email(target_test_address, successfully_sent_job_config) 
    

    def on_batch_worker_finished(self, batch_success_flag, batch_final_message, batch_stats_dict):
        """Handles completion of an OptimizedEmailSenderThread (a batch worker)."""
        finished_worker = self.sender() # QObject.sender() gets the thread that emitted the signal
        if not finished_worker or not isinstance(finished_worker, OptimizedEmailSenderThread):
            print(f"Error: on_batch_worker_finished received signal from unexpected sender: {finished_worker}")
            return

        worker_name_for_log = finished_worker.objectName() if finished_worker.objectName() else "UnnamedBatchWorker"
        print(f"on_batch_worker_finished: Signal from {worker_name_for_log}. Batch Success: {batch_success_flag}, Msg: {batch_final_message}")

        if finished_worker in self.active_batch_send_workers:
            self.active_batch_send_workers.remove(finished_worker)
        else:
            print(f"Warning: Batch worker {worker_name_for_log} not found in active list during its finish signal. Possibly handled by stop/close event.")

        # Aggregate overall stats from this batch's stats
        self.total_emails_processed_overall += batch_stats_dict.get('completed_in_batch', 0)
        self.total_emails_successful_overall += batch_stats_dict.get('successful_in_batch', 0)
        
        self.append_message_to_log_area(f"🏁 Worker {worker_name_for_log} finished. Batch Result: {batch_final_message}")
        
        # Ensure thread resources are cleaned up
        finished_worker.quit() 
        if not finished_worker.wait(7000): # Wait up to 7s for thread's run() to complete
            print(f"Warning: Batch worker {worker_name_for_log} did not quit cleanly after 7s. Its run() method might be stuck, possibly in its internal executor shutdown.")
        else:
            print(f"Batch worker {worker_name_for_log} quit cleanly.")
        finished_worker.deleteLater() # Schedule for Qt's event loop to delete
        
        self.update_queue_control_buttons_state() # Reflect one less active worker

        # If main queue processing is still active and not paused, try to dispatch the next batch.
        if self.queue_processing_active and not self.is_paused_flag:
            QTimer.singleShot(150, self.dispatch_next_email_batch_to_worker) # Short delay before next batch
        elif not self.active_batch_send_workers and \
             (self.current_job_index_for_dispatch >= len(self.email_job_queue) or not self.queue_processing_active) :
            # If no more active workers AND (all jobs dispatched OR queue explicitly stopped/finished)
            print("on_batch_worker_finished: All conditions met for finalizing overall queue processing.")
            self.finalize_overall_queue_processing()
        else:
            # Conditions not met to dispatch next or finalize (e.g., paused, or some workers still active but all jobs dispatched)
            print(f"on_batch_worker_finished: Not dispatching next batch. Queue active: {self.queue_processing_active}, Paused: {self.is_paused_flag}, Active Workers: {len(self.active_batch_send_workers)}, Dispatched all: {self.current_job_index_for_dispatch >= len(self.email_job_queue)}")


    def on_test_email_worker_finished(self, test_success_flag, test_final_message, test_stats_dict):
            """Handles completion of a test email sender thread."""
            test_worker = self.sender() 
            if not test_worker or not isinstance(test_worker, OptimizedEmailSenderThread):
                print(f"Error: on_test_email_worker_finished called by unexpected sender: {test_worker}")
                return

            worker_name_for_log = test_worker.objectName() if test_worker.objectName() else "UnnamedTestWorker"
            print(f"on_test_email_worker_finished: Signal from {worker_name_for_log}. Test Success: {test_success_flag}")
            
            # Construct a log identifier string for the test email
            log_id_str = "Test Email" # Default
            if hasattr(test_worker, 'job_batch') and test_worker.job_batch and test_worker.job_batch[0]:
                test_job_payload = test_worker.job_batch[0]
                if 'log_identifier_details' in test_job_payload:
                    log_details = test_job_payload['log_identifier_details']
                    log_id_str = f"Test ID: {log_details.get('job_id_short','N/A')}, To: {log_details.get('recipient','N/A')}, Src: {log_details.get('source_type','N/A')}"
            
            if test_success_flag:
                self.append_message_to_log_area(f"<font color='green'>✅ TEST EMAIL SUCCESS: {log_id_str} - {test_final_message}</font>")
            else:
                self.append_message_to_log_area(f"<font color='red'>❌ TEST EMAIL FAILED: {log_id_str} - {test_final_message}</font>")
            
            self.status_bar.showMessage(f"Test email ({log_id_str.split('To: ')[-1].split(',')[0]}): {test_final_message}", 8000)
    
            if test_worker in self.active_test_email_workers:
                self.active_test_email_workers.remove(test_worker)
            
            test_worker.quit()
            if not test_worker.wait(7000): 
                print(f"Warning: Test email worker {worker_name_for_log} did not stop cleanly after 7s.")
            else:
                print(f"Test email worker {worker_name_for_log} stopped cleanly.")
            test_worker.deleteLater()
    

    def finalize_overall_queue_processing(self):
        """Finalizes overall queue processing when all jobs are done or queue is stopped and all workers finished."""
        print("Finalize Overall Queue Processing called.")
        self.queue_processing_active = False 
        self.is_paused_flag = False 
        self.overall_processing_end_time = time.time() 
        
        elapsed_total_seconds = self.overall_processing_end_time - self.overall_processing_start_time if self.overall_processing_start_time > 0 else 0
        success_rate_overall = (self.total_emails_successful_overall / max(self.total_emails_processed_overall, 1)) * 100
        avg_speed_overall = self.total_emails_processed_overall / elapsed_total_seconds if elapsed_total_seconds > 0.01 else 0
        
        time_str_formatted = f"{int(elapsed_total_seconds // 3600):02d}h:{int((elapsed_total_seconds // 60) % 60):02d}m:{int(elapsed_total_seconds % 60):02d}s"

        final_summary_html = (f"<br><b style='color: #400090;'>🎉 CAMPAIGN PROCESSING COMPLETE! 🎉</b><br>"
                              f"  📊 Total Results: {self.total_emails_successful_overall} / {self.total_emails_processed_overall} successful ({success_rate_overall:.1f}%).<br>"
                              f"  ⚡ Average Speed: {avg_speed_overall:.1f} emails/second.<br>"
                              f"  ⏱️ Total Time: {time_str_formatted}.")
        
        self.append_message_to_log_area(final_summary_html)
        self.status_bar.showMessage(f"✅ Campaign complete! Avg Speed: {avg_speed_overall:.1f} eps. Total Success: {self.total_emails_successful_overall}/{self.total_emails_processed_overall}", 20000)
        
        self.overall_progress_bar.setValue(100)
        self.overall_progress_bar.setFormat("✅ Campaign Complete - Ready")
        
        # self.current_job_index_for_dispatch = 0 # Optional: Reset for a new run with the same queue
        # self.email_job_queue.clear() # Optional: Clear queue automatically after completion

        self.refresh_performance_stats_display() # Update stats label one last time
        self.update_queue_control_buttons_state()


    def handle_batch_worker_progress_update(self, completed_in_batch_worker, active_in_batch_worker, total_in_batch_worker):
        """Updates overall progress bar based on detailed progress from all active batch workers."""
        # This signal provides progress from one specific batch worker's internal queue.
        # For overall progress, we sum up `total_emails_processed_overall` (from finished batches)
        # and estimate progress in currently active batches.
        
        if len(self.email_job_queue) > 0:
            # `self.total_emails_processed_overall` counts fully completed jobs from *finished* batches.
            # `self.current_job_index_for_dispatch` points to the start of the *next* batch to be dispatched.
            # Jobs between `self.total_emails_processed_overall` and `self.current_job_index_for_dispatch`
            # are within batches that have been dispatched but might not be fully complete yet.
            
            # A simpler approach for overall progress:
            current_overall_progress_percent = int((self.total_emails_processed_overall / len(self.email_job_queue)) * 100)
            
            # More refined text for progress bar
            active_workers_count = len(self.active_batch_send_workers)
            progress_bar_text = f"Overall: {self.total_emails_processed_overall}/{len(self.email_job_queue)} ({current_overall_progress_percent}%)"
            if active_workers_count > 0:
                progress_bar_text += f" - Active Batch Workers: {active_workers_count}"
            
            self.overall_progress_bar.setValue(current_overall_progress_percent)
            self.overall_progress_bar.setFormat(progress_bar_text)
        else: # No jobs in queue
            self.overall_progress_bar.setValue(0)
            self.overall_progress_bar.setFormat("Ready")


    def action_toggle_pause_resume_queue(self):
        """Toggles the pause/resume state of the email sending queue."""
        if not self.queue_processing_active and not self.email_job_queue:
            self.status_bar.showMessage("Queue is not active or is empty. Nothing to pause/resume.", 3000)
            return
        
        # If trying to resume a queue that has already finished all its jobs
        if not self.is_paused_flag and self.current_job_index_for_dispatch >= len(self.email_job_queue) and not self.active_batch_send_workers:
             QMessageBox.information(self, "Campaign Finished", "The email campaign has finished processing. Add more emails or prepare a new campaign.")
             return

        self.is_paused_flag = not self.is_paused_flag
        
        if self.is_paused_flag:
            self.pause_resume_sending_button.setText("▶️ Resume Sending")
            self.pause_resume_sending_button.setIcon(QIcon.fromTheme("media-playback-start"))
            self.status_bar.showMessage("⏸️ Campaign paused. Active batches will complete; no new batches will start.", 5000)
            self.append_message_to_log_area("<i style='color: orange;'>--- ⏸️ CAMPAIGN PAUSED (Active batches will finish, no new batches will be dispatched) ---</i>")
            # Active batch workers continue their current batch. No new batches dispatched by `dispatch_next_email_batch_to_worker`.
        else: # Resuming
            self.queue_processing_active = True # Ensure active if it was somehow stopped then resumed
            self.pause_resume_sending_button.setText("⏸️ Pause Sending")
            self.pause_resume_sending_button.setIcon(QIcon.fromTheme("media-playback-pause"))
            self.status_bar.showMessage("▶️ Campaign resumed.", 3000)
            self.append_message_to_log_area("<i style='color: #400090;'>--- ▶️ CAMPAIGN RESUMED ---</i>")
            
            # If resuming and there are jobs left to dispatch or workers still active
            if self.current_job_index_for_dispatch < len(self.email_job_queue) or self.active_batch_send_workers:
                 QTimer.singleShot(100, self.dispatch_next_email_batch_to_worker) # Start dispatching again
            else: # No jobs left and no active workers, effectively finished
                 self.finalize_overall_queue_processing()
        
        self.update_queue_control_buttons_state()


    def action_stop_queue_processing_and_clear(self):
        """Stops all email processing, clears the pending job queue, and signals workers to terminate."""
        if not self.queue_processing_active and not self.email_job_queue and not self.active_batch_send_workers and not self.active_test_email_workers:
            self.status_bar.showMessage("Nothing to stop (queue empty and no active workers).", 3000)
            return

        active_main_workers_count = len(self.active_batch_send_workers)
        active_test_workers_count = len(self.active_test_email_workers)
        total_active_workers = active_main_workers_count + active_test_workers_count
        
        confirm_msg = "Are you sure you want to stop all email processing and clear the pending job queue?"
        if total_active_workers > 0:
            confirm_msg += f"\n\n({total_active_workers} email worker thread(s) are currently active and will be signalled to stop. This may take a moment.)"

        reply = QMessageBox.question(self, 'Confirm Stop Processing & Clear Queue', confirm_msg, 
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)

        if reply == QMessageBox.Yes:
            self.status_bar.showMessage("🛑 Stopping all processing and clearing queue...", 0) # Persistent
            QApplication.processEvents() # Allow UI to update status message

            self.queue_processing_active = False # Critical: stop new dispatches
            self.is_paused_flag = True # Reinforce stopping

            # Signal all active workers (main batch and test email workers) to stop.
            # Make copies of lists as they might be modified by worker finish signals during iteration.
            all_workers_to_signal_stop = list(self.active_batch_send_workers) + list(self.active_test_email_workers)
            
            print(f"Stop Action: Signalling {len(all_workers_to_signal_stop)} worker(s) to stop...")
            for worker_thread in all_workers_to_signal_stop:
                if hasattr(worker_thread, 'stop'):
                    worker_thread.stop() # Calls the non-blocking stop() method of the thread

            # Wait for threads to finish their run() methods.
            # This is important for graceful shutdown of their internal resources (like executors).
            print(f"Stop Action: Waiting for {len(all_workers_to_signal_stop)} worker(s) to finish...")
            # Timeout per worker (can be long if many workers or slow tasks)
            wait_timeout_ms_per_worker = 7000 
            
            for i, worker_thread in enumerate(all_workers_to_signal_stop):
                worker_name = worker_thread.objectName() if worker_thread.objectName() else f"Worker-{worker_thread.objectName()}"
                print(f"Stop Action: Waiting for worker {i+1}/{len(all_workers_to_signal_stop)} ({worker_name})...")
                worker_thread.quit() # Tell Qt's event loop for the thread to exit
                if not worker_thread.wait(wait_timeout_ms_per_worker):
                    print(f"Warning (Stop Action): Worker thread {worker_name} did not finish its run method cleanly after {wait_timeout_ms_per_worker}ms. It might be stuck or have ungracefully terminated.")
                else:
                    print(f"Stop Action: Worker {worker_name} finished its run method.")
                
                # Remove from lists after processing (though they might already be removed by finish signals)
                if worker_thread in self.active_batch_send_workers: self.active_batch_send_workers.remove(worker_thread)
                if worker_thread in self.active_test_email_workers: self.active_test_email_workers.remove(worker_thread)
                worker_thread.deleteLater() # Schedule for Qt's garbage collection

            self.active_batch_send_workers.clear() # Ensure lists are empty
            self.active_test_email_workers.clear()

            # Clear the main email job queue
            # total_emails_processed_overall reflects what was actually sent or attempted by workers.
            # Jobs remaining in self.email_job_queue beyond self.current_job_index_for_dispatch were never dispatched.
            # Jobs between self.total_emails_processed_overall and self.current_job_index_for_dispatch were dispatched but may have been interrupted.
            
            jobs_in_queue_before_clear = len(self.email_job_queue)
            # Count jobs that were in queue but not fully processed by any worker
            cleared_pending_jobs_count = max(0, jobs_in_queue_before_clear - self.total_emails_processed_overall) 
            
            self.email_job_queue.clear()
            self.current_job_index_for_dispatch = 0 # Reset dispatch index
            
            self.overall_processing_end_time = time.time()
            elapsed_before_stop = self.overall_processing_end_time - self.overall_processing_start_time if self.overall_processing_start_time > 0 else 0
            final_stats_message = (f"⏹️ Processing stopped by user after {elapsed_before_stop:.1f}s. "
                                   f"{self.total_emails_processed_overall} emails were processed (sent or attempted) before stop. "
                                   f"{cleared_pending_jobs_count} pending jobs cleared from queue.")
            
            self.append_message_to_log_area(f"<br><b style='color: red;'>{final_stats_message}</b>")
            self.status_bar.showMessage("⏹️ Processing stopped and queue cleared by user.", 10000)
            
            self.overall_progress_bar.setValue(0) # Reset progress bar
            self.overall_progress_bar.setFormat("⏹️ Stopped - Ready")
            
            self.pause_resume_sending_button.setText("⏸️ Pause Sending") # Reset pause button text/icon
            self.pause_resume_sending_button.setIcon(QIcon.fromTheme("media-playback-pause"))
            self.refresh_performance_stats_display() # Show final (stopped) stats
        
        self.update_queue_control_buttons_state()


    # --- Account Management Functions ---
    def load_configured_as_accounts(self):
        """Load Apps Script accounts from consolidated file and update UI list."""
        all_data = _load_all_senders_data_from_consolidated_file()
        self.configured_as_accounts = all_data.get('appsscript_accounts', [])
        
        if not isinstance(self.configured_as_accounts, list):
            print("Warning: Apps Script accounts data in consolidated file is corrupted or not a list. Resetting to empty.")
            self.configured_as_accounts = []

        self.sender_accounts_list_widget_as_ref.clear()
        if not self.configured_as_accounts:
            item = QListWidgetItem("No Apps Script accounts configured.")
            item.setFlags(item.flags() & ~Qt.ItemIsSelectable & ~Qt.ItemIsUserCheckable) 
            self.sender_accounts_list_widget_as_ref.addItem(item)
            self.sender_accounts_list_widget_as_ref.setEnabled(False)
        else:
            self.sender_accounts_list_widget_as_ref.setEnabled(True)
            for acc_data in self.configured_as_accounts:
                display_name = acc_data.get('nickname') or acc_data.get('email', 'Unnamed Account')
                item_text = f"{display_name} (Apps Script: {acc_data.get('email','N/A')})"
                item = QListWidgetItem(item_text)
                item.setToolTip(f"Email: {acc_data.get('email', 'N/A')}\nWeb App URL: {acc_data.get('web_app_url', 'Not set')}\nDefault Sender Name: {acc_data.get('sender_display_name', '(Gmail Default)')}")
                item.setData(Qt.UserRole, acc_data) 
                item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
                item.setCheckState(Qt.Unchecked) 
                self.sender_accounts_list_widget_as_ref.addItem(item)
        
        self.update_queue_control_buttons_state()

    def load_configured_generic_smtp_servers(self):
            """Load Generic SMTP servers, setup/update rate limiters, and refresh UI list."""
            all_data = _load_all_senders_data_from_consolidated_file()
            servers_data_list = all_data.get('generic_smtp_servers', [])
            
            if not isinstance(servers_data_list, list):
                print("Warning: Generic SMTP Servers data in consolidated file is corrupted. Resetting to empty.")
                self.configured_generic_smtp_servers = []
            else:
                self.configured_generic_smtp_servers = servers_data_list
    
            # Update or create rate limiters in the central pool (self.rate_limiters_pool)
            current_limiter_nicknames_in_pool = set(self.rate_limiters_pool.keys())
            configured_server_nicknames_from_file = set()
    
            for server_config_dict in self.configured_generic_smtp_servers:
                nickname = server_config_dict.get('nickname')
                if not nickname: 
                    print(f"Warning: SMTP server config found without a nickname (Host: {server_config_dict.get('host')}). This server cannot be used with rate limiting by nickname.")
                    continue 
                    
                configured_server_nicknames_from_file.add(nickname)
                
                emails_per_period = int(server_config_dict.get('rate_limit_emails', 10))
                period_seconds = float(server_config_dict.get('rate_limit_seconds', 1.0))
                burst_allowance = int(server_config_dict.get('burst_size', 5)) # Corrected default to 5 as per dialog
                
                effective_emails_per_sec = 1000 
                if emails_per_period > 0 and period_seconds > 0:
                    effective_emails_per_sec = emails_per_period / period_seconds
                
                if nickname not in self.rate_limiters_pool:
                    self.rate_limiters_pool[nickname] = AdvancedRateLimiter(effective_emails_per_sec, burst_allowance)
                    print(f"Rate Limiter CREATED for SMTP server '{nickname}': {effective_emails_per_sec:.2f} eps, burst {burst_allowance}")
                else: 
                    limiter = self.rate_limiters_pool[nickname]
                    limiter.emails_per_second = effective_emails_per_sec
                    limiter.burst_size = burst_allowance
                    print(f"Rate Limiter UPDATED for SMTP server '{nickname}': {effective_emails_per_sec:.2f} eps, burst {burst_allowance}")
    
            for old_nickname_no_longer_configured in current_limiter_nicknames_in_pool - configured_server_nicknames_from_file:
                if old_nickname_no_longer_configured in self.rate_limiters_pool:
                    del self.rate_limiters_pool[old_nickname_no_longer_configured]
                    print(f"Rate Limiter REMOVED for stale SMTP server: {old_nickname_no_longer_configured}")
    
            # Update the UI list for Generic SMTP servers
            # Check specifically if the attribute is not None, rather than just its truthiness.
            if hasattr(self, 'sender_accounts_list_widget_generic_smtp_ref') and \
            self.sender_accounts_list_widget_generic_smtp_ref is not None: # More explicit check
                self.sender_accounts_list_widget_generic_smtp_ref.clear() 
                
                if not self.configured_generic_smtp_servers:
                    item = QListWidgetItem("No Generic SMTP servers configured.")
                    item.setFlags(item.flags() & ~Qt.ItemIsSelectable & ~Qt.ItemIsUserCheckable)
                    self.sender_accounts_list_widget_generic_smtp_ref.addItem(item)
                    self.sender_accounts_list_widget_generic_smtp_ref.setEnabled(False)
                else:
                    self.sender_accounts_list_widget_generic_smtp_ref.setEnabled(True)
                    for server_dict in self.configured_generic_smtp_servers:
                        emails_disp = int(server_dict.get('rate_limit_emails', 0))
                        seconds_disp = float(server_dict.get('rate_limit_seconds', 1.0))
                        burst_disp = int(server_dict.get('burst_size', 5)) # Corrected default to 5
                        
                        rate_str = "Unlimited"
                        if emails_disp > 0 and seconds_disp > 0:
                            rate_str = f"{emails_disp}/{seconds_disp:.1f}s (burst:{burst_disp})"
    
                        item_text = f"⚡ {server_dict.get('nickname', 'Unnamed')} ({server_dict.get('host')}:{server_dict.get('port')}) [{rate_str}]"
                        item = QListWidgetItem(item_text)
                        
                        tooltip_str = (f"Host: {server_dict.get('host', 'N/A')}:{server_dict.get('port', 'N/A')}\n"
                                    f"User: {server_dict.get('username', '(Not set)')}\n"
                                    f"Encryption: {server_dict.get('encryption', 'N/A')}\n"
                                    f"Default From: {server_dict.get('from_address', '(Not set)')}\n"
                                    f"Rate Limit: {rate_str}")
                        item.setToolTip(tooltip_str)
                        item.setData(Qt.UserRole, server_dict) 
                        item.setFlags(Qt.ItemIsSelectable | Qt.ItemIsUserCheckable | Qt.ItemIsEnabled) 
                        item.setCheckState(Qt.Unchecked) 
                        self.sender_accounts_list_widget_generic_smtp_ref.addItem(item)
            else:
                print("Warning: Generic SMTP server list widget UI element ('sender_accounts_list_widget_generic_smtp_ref') not found or is None during load_configured_generic_smtp_servers.")
            
            self.update_queue_control_buttons_state()
    

    def get_selected_as_accounts_from_ui(self):
        """Get a list of currently checked Apps Script accounts from the UI list."""
        selected_accounts_list = []
        if hasattr(self, 'sender_accounts_list_widget_as_ref'):
            for i in range(self.sender_accounts_list_widget_as_ref.count()):
                item = self.sender_accounts_list_widget_as_ref.item(i)
                if item.checkState() == Qt.Checked:
                    account_data_dict = item.data(Qt.UserRole)
                    if account_data_dict: selected_accounts_list.append(account_data_dict)
        return selected_accounts_list

    def get_selected_generic_smtp_servers_from_ui(self):
        """Get a list of currently checked Generic SMTP servers from the UI list."""
        selected_servers_list = []
        if hasattr(self, 'sender_accounts_list_widget_generic_smtp_ref'):
            for i in range(self.sender_accounts_list_widget_generic_smtp_ref.count()):
                item = self.sender_accounts_list_widget_generic_smtp_ref.item(i)
                if item.checkState() == Qt.Checked:
                    server_data_dict = item.data(Qt.UserRole)
                    if server_data_dict: selected_servers_list.append(server_data_dict)
        return selected_servers_list

    def show_manage_as_accounts_dialog(self):
        dialog = ManageAccountsDialogAppsScript(self) # Parent to main window
        if dialog.exec_() == QDialog.Accepted: # If changes were saved
            self.load_configured_as_accounts() # Reload and update UI to reflect changes
            self.status_bar.showMessage("🔄 Apps Script account configurations updated.", 3000)

    def show_manage_generic_smtp_servers_dialog(self):
        dialog = ManageGenericSMTPServersDialog(self) # Parent to main window
        if dialog.exec_() == QDialog.Accepted: # If changes were saved
            self.load_configured_generic_smtp_servers() # Reload, update UI, and refresh rate limiters
            self.status_bar.showMessage("⚡ SMTP server configurations and rate limiters updated.", 3000)

    # --- UI Helper Functions ---
    def update_queue_control_buttons_state(self):
            """Update enable/disable state of main queue control buttons based on current app state."""
            has_jobs_in_prepared_queue = bool(self.email_job_queue)
            
            # Determine if a valid sender is configured and selected for the current method
            can_prepare_or_start_based_on_sender = False
            send_method = self.send_via_combo_box.currentText()
            if "Apps Script" in send_method:
                can_prepare_or_start_based_on_sender = bool(self.get_selected_as_accounts_from_ui())
            elif "Generic SMTP" in send_method:
                can_prepare_or_start_based_on_sender = bool(self.get_selected_generic_smtp_servers_from_ui())
            
            # "Prepare Campaign & Add to Queue" button
            # Enabled if not actively processing (or paused) AND a sender is configured and selected.
            self.prepare_campaign_add_to_queue_button.setEnabled(
                (not self.queue_processing_active or self.is_paused_flag) and can_prepare_or_start_based_on_sender
            )
            
            # "Clear All Input Fields" button
            # Enabled if not actively processing (or paused).
            self.clear_all_fields_button.setEnabled(not self.queue_processing_active or self.is_paused_flag)
    
            # "Start Sending Prepared Campaign" button
            # Enabled if:
            #   1. There are jobs in the prepared queue.
            #   2. Processing is not currently active OR it is paused.
            #   3. A valid sender is configured and selected.
            #   4. There are jobs actually pending dispatch (current_job_index < total_jobs).
            can_start_sending = (has_jobs_in_prepared_queue and 
                                (not self.queue_processing_active or self.is_paused_flag) and 
                                can_prepare_or_start_based_on_sender and
                                (self.current_job_index_for_dispatch < len(self.email_job_queue)))
            self.start_sending_queue_button.setEnabled(can_start_sending)
    
            # "Pause/Resume Sending" button
            # Enabled only if queue processing has been started (is active).
            self.pause_resume_sending_button.setEnabled(self.queue_processing_active)
            
            # "Stop Sending & Clear Queue" button
            # Enabled if there are jobs in the queue OR if processing is active (main or test workers).
            # CORRECTED LOGIC HERE:
            can_stop = (has_jobs_in_prepared_queue or 
                        self.queue_processing_active or 
                        bool(self.active_batch_send_workers) or  # Convert list to boolean
                        bool(self.active_test_email_workers))   # Convert list to boolean
            self.stop_sending_clear_queue_button.setEnabled(can_stop)



    def on_send_method_changed_update_visibility(self):
        """Update sender configuration UI panel visibility based on selected send method."""
        send_method = self.send_via_combo_box.currentText()
        if "Apps Script" in send_method:
            self.sender_config_stacked_widget.setCurrentIndex(0) # Show Apps Script config panel
        elif "Generic SMTP" in send_method:
            self.sender_config_stacked_widget.setCurrentIndex(1) # Show Generic SMTP config panel
        # Add PMTA case here if/when implemented:
        # elif "PowerMTA" in send_method: self.sender_config_stacked_widget.setCurrentIndex(2)
        
        self.update_queue_control_buttons_state() # Button states might change based on sender selection


    def update_status_bar_message_from_thread(self, message_text):
        """Update status bar with messages from worker threads."""
        self.status_bar.showMessage(message_text, 4500) # Show for 4.5 seconds

    def update_overall_progress_bar_display(self, value_percent, description_text):
        """Update main progress bar with a value (0-100) and descriptive text.
           This is usually for batch-specific progress updates from a worker, or overall.
        """
        # This might be used by individual workers for their internal progress.
        # The handle_batch_worker_progress_update provides a more aggregate view.
        # For now, let this set the bar directly if called.
        self.overall_progress_bar.setValue(value_percent)
        self.overall_progress_bar.setFormat(f"{description_text} - {value_percent}%")


    def append_message_to_log_area(self, html_formatted_message):
        """Append an HTML formatted message to the main send log area."""
        if hasattr(self, 'send_log_text_area') and self.send_log_text_area:
            timestamp_str = datetime.now().strftime("%H:%M:%S.%f")[:-3] # HH:MM:SS.ms
            log_entry_html = f"<span style='color: #777;'>[{timestamp_str}]</span> {html_formatted_message}<br>"
            
            self.send_log_text_area.moveCursor(QTextCursor.End)
            self.send_log_text_area.insertHtml(log_entry_html)
            self.send_log_text_area.moveCursor(QTextCursor.End) # Ensure scroll to bottom
            QApplication.processEvents() # Allow UI to update log immediately (use with care)


    # --- Placeholder Resolution and Content Generation ---
    def _parse_recipients(self, recipients_string_input):
        """Parse recipient email addresses from a string, with improved validation."""
        if not recipients_string_input or not recipients_string_input.strip():
            return []
        
        # RFC 5322 general pattern (not fully strict but good for most common emails)
        email_regex_pattern = re.compile(
            r"(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"
            r'"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@'
            r"(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|"
            r"\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}"
            r"(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:"
            r"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])", 
            re.IGNORECASE
        )
        
        # Split by common delimiters (comma, semicolon, whitespace)
        potential_email_strings = re.split(r'[,\s;]+', recipients_string_input)
        valid_email_list = []
        seen_emails_lowercase = set()

        for email_candidate_str in potential_email_strings:
            email_candidate_str = email_candidate_str.strip()
            if email_regex_pattern.fullmatch(email_candidate_str): # Use fullmatch for entire string
                email_lower = email_candidate_str.lower() # For duplicate check
                if email_lower not in seen_emails_lowercase:
                    seen_emails_lowercase.add(email_lower)
                    valid_email_list.append(email_candidate_str) # Keep original casing
        
        return valid_email_list


    def _resolve_all_placeholders_and_tags(self, text_template_input, data_list_row_dict, job_specific_context_dict, boundary_tag_cache_for_job):
        """Resolves all placeholders (from data, job context) and dynamic tags in a given text template."""
        if text_template_input is None: return ""
        
        resolved_text_str = str(text_template_input) # Ensure working with a string
        
        # 1. Resolve Data Placeholders (e.g., {{column_header_from_csv}})
        #    These come from the data_list_row_dict (CSV/Excel/GSheet row data).
        #    data_list_row_dict keys are pre-cleaned (lowercase, underscore for space).
        if data_list_row_dict:
            for cleaned_header_key, data_value in data_list_row_dict.items():
                # Regex matches {{placeholder_key}}, allowing spaces, case-insensitive.
                # Handles {{key}}, {{ Key }}, {{KEY}}, etc.
                placeholder_pattern_regex = r"\{\{\s*" + re.escape(cleaned_header_key) + r"\s*\}\}"
                try:
                    resolved_text_str = re.sub(placeholder_pattern_regex, str(data_value), resolved_text_str, flags=re.IGNORECASE)
                except re.error as e:
                    print(f"Regex error replacing data placeholder for key '{cleaned_header_key}': {e}")

        # 2. Resolve Job Context Placeholders (e.g., {{email_id}}, {{current_recipient_email}})
        #    These are from job_specific_context_dict.
        if job_specific_context_dict:
            for context_key, context_value in job_specific_context_dict.items():
                placeholder_pattern_regex = r"\{\{\s*" + re.escape(context_key) + r"\s*\}\}"
                try:
                    resolved_text_str = re.sub(placeholder_pattern_regex, str(context_value), resolved_text_str, flags=re.IGNORECASE)
                except re.error as e:
                     print(f"Regex error replacing context placeholder for key '{context_key}': {e}")
        
        # 3. Resolve Dynamic Tags (e.g., {{[date]}}, {{[rndn_10]}}, #{{[token]}})
        def dynamic_tag_replacer_func(match_object):
            full_matched_tag = match_object.group(0) # e.g., "{{[date]}}" or "#{{[token]}}"
            
            # Handle specific #{{[token]}} boundary tag (fixed per job)
            if full_matched_tag == "#{{[token]}}":
                if full_matched_tag not in boundary_tag_cache_for_job:
                    boundary_tag_cache_for_job[full_matched_tag] = generate_random_string(12, 'a') # 12-char alphanumeric
                return boundary_tag_cache_for_job[full_matched_tag]

            # Handle general {{[... ]}} tags
            tag_content_match_obj = re.match(r"\{\{\[(.*?)\]\}\}", full_matched_tag)
            if not tag_content_match_obj:
                return full_matched_tag # Not a recognized {{[tag]}} format, leave as is

            tag_content_key = tag_content_match_obj.group(1).strip() # Content inside {{[ ]}}

            # --- Basic Dynamic Tags ---
            if tag_content_key == "ide": return job_specific_context_dict.get("email_id", str(uuid.uuid4())[:12]) # Prefer context, fallback
            if tag_content_key == "date": return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if tag_content_key == "tag": return generate_random_string(8, 'a') # Short, fresh alphanumeric
            if tag_content_key == "rnd": return generate_random_string(18, 'a') # Default long random, fresh

            # --- Context-dependent Tags (should already be in job_specific_context_dict for {{key}} replacement) ---
            # These ensure {{[tag_name]}} also works if user prefers that syntax for context vars.
            if tag_content_key == "fromname": return job_specific_context_dict.get("current_from_name_for_job", "")
            if tag_content_key == "subject": return job_specific_context_dict.get("current_subject_for_job", "")
            if tag_content_key == "to": return job_specific_context_dict.get("current_recipient_email", "")
            if tag_content_key == "name": # Username part of 'to' email
                recipient_email_str = job_specific_context_dict.get("current_recipient_email", "")
                return recipient_email_str.split('@')[0] if '@' in recipient_email_str else ""
            
            # SMTP specific context tags
            if tag_content_key == "smtp": return job_specific_context_dict.get("smtp_username_for_tag", "")
            if tag_content_key == "smtp_name": return job_specific_context_dict.get("smtp_server_nickname_for_tag", "")
            
            # --- Variable Length Random String Tags: {{[rnd<type>_N]}} and {{[bnd<type>_N]}} ---
            # Example: {{[rndn_10]}} (10 random numbers), {{[bnda_5]}} (5 random alphanumeric, boundary)
            var_len_tag_match = re.match(r"^(rnd|bnd)([nalus]{1,2})_(\d+)$", tag_content_key) # char_set_keys: n,a,l,u,s, lu, ln, un
            if var_len_tag_match:
                tag_kind_prefix, char_set_suffix, length_str = var_len_tag_match.groups()
                length_int = int(length_str)
                if not (0 < length_int <= 1024): # Safety: Length 1 to 1024
                    return full_matched_tag # Invalid length, return original tag
                
                if tag_kind_prefix == "bnd": # Boundary tag - generate once per job, use cache
                    if full_matched_tag not in boundary_tag_cache_for_job:
                        boundary_tag_cache_for_job[full_matched_tag] = generate_random_string(length_int, char_set_suffix)
                    return boundary_tag_cache_for_job[full_matched_tag]
                else: # "rnd" tag - generate fresh each time
                    return generate_random_string(length_int, char_set_suffix)
            
            return full_matched_tag # If no specific dynamic tag match, return the original string

        # Regex to find all occurrences of {{[... ]}} or #{{[token]}}
        # Ensure #{{[token]}} is matched distinctly.
        dynamic_tag_pattern_regex = re.compile(r"(#\{\{\[token\]\}\}|\{\{\[.*?\]\}\})")
        resolved_text_str = dynamic_tag_pattern_regex.sub(dynamic_tag_replacer_func, resolved_text_str)
        
        return resolved_text_str


    def process_spintax_in_text(self, text_with_spintax):
        """Process spintax like {option1|option2|option3} in text, resolving innermost first."""
        if not text_with_spintax or '{' not in text_with_spintax: # Quick check for spintax presence
            return text_with_spintax
        
        # Regex to find the innermost spintax construct: '{' followed by chars except '{' or '}', then '}'
        # This ensures correct resolution of nested spintax like {A|{B|C}|D}.
        spintax_pattern = re.compile(r'\{([^{}]*?)\}')
        
        processed_text = str(text_with_spintax) # Work on a copy
        
        # Limit iterations to prevent infinite loops with malformed spintax (e.g., unclosed braces)
        # Max 10 levels of nesting should be more than sufficient for typical email content.
        for _ in range(10): 
            match_innermost = spintax_pattern.search(processed_text)
            if not match_innermost:
                break # No more spintax constructs found, processing is complete
            
            spintax_content_segment = match_innermost.group(1) # Content between the innermost {}
            
            if '|' in spintax_content_segment: # It's a choice construction
                options_list = [opt.strip() for opt in spintax_content_segment.split('|')]
                chosen_option_str = random.choice(options_list) if options_list else ""
                # Replace only the first occurrence of this specific innermost spintax match
                processed_text = processed_text.replace(match_innermost.group(0), chosen_option_str, 1) 
            else:
                # If no '|' inside {}, it's not a standard choice spintax.
                # It might be a placeholder like {{[tag]}} or {{data_column}} (handled by _resolve_all_placeholders_and_tags)
                # or simply text enclosed in braces that isn't meant for spintax choices (e.g., "{Note: Important}").
                # To avoid altering these, if no pipe is found, we replace the match with itself.
                # This effectively "consumes" this match for the current iteration without changing it,
                # allowing the loop to continue searching for other valid spintax.
                # This logic ensures that only {A|B} style spintax is processed here.
                processed_text = processed_text.replace(match_innermost.group(0), match_innermost.group(0), 1)
                # A more advanced approach might involve lookaheads/behinds if spintax could conflict with other {{}} syntaxes,
                # but the current _resolve_all_placeholders_and_tags handles {{}} first.

        return processed_text


    # --- UI Interaction Handlers ---
    def clear_all_compose_fields_ui(self, confirm=True):
        """Clear all campaign input fields across UI tabs after confirmation."""
        if confirm:
            reply = QMessageBox.question(self, 'Clear All Input Fields', 
                                         "This will clear all input fields related to campaign setup (Recipients, Content, Data Sources, AI tools).\n\n"
                                         "The processing queue, logs, and saved account configurations will NOT be affected.\n\n"
                                         "Are you sure you want to clear all campaign input fields?",
                                         QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
            if reply != QMessageBox.Yes:
                return
        
        # Campaign Setup Tab fields
        if hasattr(self, 'to_field_input'): self.to_field_input.clear()
        
        # Content Creation Tab fields
        if hasattr(self, 'from_name_text_editor'): self.from_name_text_editor.clear()
        if hasattr(self, 'subject_lines_text_editor'): self.subject_lines_text_editor.clear()
        if hasattr(self, 'email_body_text_input'): self.email_body_text_input.clear()
        if hasattr(self, 'custom_headers_text_input'): self.custom_headers_text_input.clear()
        if hasattr(self, 'enable_custom_headers_checkbox'): self.enable_custom_headers_checkbox.setChecked(False)

        # Data Source related fields (on Campaign Setup Tab)
        if hasattr(self, 'csv_data_paste_area'): self.csv_data_paste_area.clear()
        if hasattr(self, 'excel_file_status_label'): self.excel_file_status_label.setText("No Excel file loaded.")
        self.loaded_excel_file_path = None # Reset state variable
        if hasattr(self, 'google_sheet_url_field'): self.google_sheet_url_field.clear()
        if hasattr(self, 'google_sheet_status_label'): self.google_sheet_status_label.setText("No Google Sheet data loaded.")
        self.loaded_google_sheet_url = None # Reset state variable
        self.data_content_from_file_or_url = None # Clear loaded data content string

        # AI Tools Tab fields
        if hasattr(self, 'base_subject_idea_field'): self.base_subject_idea_field.clear()
        if hasattr(self, 'generated_subjects_display_list'): self.generated_subjects_display_list.clear()
        
        self.status_bar.showMessage("All campaign input fields cleared.", 3000)


    def action_prepare_campaign_and_add_to_queue(self):
            """Main function to prepare the entire email campaign based on UI inputs
            and add all generated email jobs to the processing queue.
            This is the **campaign preparation phase**.
            """
            # Determine selected sending method and validate accounts
            send_method_str = self.send_via_combo_box.currentText()
            selected_as_accounts_list = []
            selected_generic_smtp_servers_list = []
            as_account_cycler_iter = None
            generic_smtp_server_cycler_iter = None
    
            if "Apps Script" in send_method_str:
                selected_as_accounts_list = self.get_selected_as_accounts_from_ui()
                if not selected_as_accounts_list:
                    QMessageBox.warning(self, "Configuration Error", "No Apps Script accounts selected/configured. Cannot prepare campaign.")
                    return
                as_account_cycler_iter = itertools.cycle(selected_as_accounts_list)
            elif "Generic SMTP" in send_method_str:
                selected_generic_smtp_servers_list = self.get_selected_generic_smtp_servers_from_ui()
                if not selected_generic_smtp_servers_list:
                    QMessageBox.warning(self, "Configuration Error", "No Generic SMTP server(s) selected/configured. Cannot prepare campaign.")
                    return
                generic_smtp_server_cycler_iter = itertools.cycle(selected_generic_smtp_servers_list)
            else: # Should not happen with current UI options
                QMessageBox.critical(self, "Internal Error", "Invalid sending method selected. Please report this.")
                return
    
            # Get email content templates from UI
            all_subject_templates_from_ui = [s.strip() for s in self.subject_lines_text_editor.toPlainText().strip().split('\n') if s.strip()]
            if not all_subject_templates_from_ui: all_subject_templates_from_ui = [""] # Default if none
    
            all_from_name_templates_from_ui = [fn.strip() for fn in self.from_name_text_editor.toPlainText().strip().split('\n') if fn.strip()]
            if not all_from_name_templates_from_ui: all_from_name_templates_from_ui = [""] # Default if none
            
            base_to_recipients_template_ui = self.to_field_input.text().strip()
            # Get HTML and Plain body templates (these are pre-resolution)
            body_html_template_from_ui, body_plain_template_from_ui = self.get_email_body_content_templates()
            
            if not body_html_template_from_ui and not body_plain_template_from_ui:
                if QMessageBox.question(self, 'Empty Body Confirmation', 
                                        "The email body content is empty. Do you want to prepare the campaign and add email(s) to the queue anyway?", 
                                        QMessageBox.Yes | QMessageBox.No, QMessageBox.No) == QMessageBox.No: 
                    return
    
            # Determine data source and content
            data_source_content_str, source_description_for_log_msg = None, "single UI email"
            # original_csv_headers_list = [] # Not strictly needed here if data_dict keys are consistently cleaned
            data_source_type_selected = self.data_source_type_combo.currentText()
            
            if "Paste CSV Data" in data_source_type_selected:
                data_source_content_str = self.csv_data_paste_area.toPlainText().strip()
                if data_source_content_str: source_description_for_log_msg = "pasted CSV data"
            elif "Excel File" in data_source_type_selected:
                if self.data_content_from_file_or_url and self.loaded_excel_file_path: 
                    data_source_content_str = self.data_content_from_file_or_url.strip()
                    source_description_for_log_msg = f"Excel file: {os.path.basename(self.loaded_excel_file_path)}"
                elif self.loaded_excel_file_path: # File path exists but content missing
                    QMessageBox.warning(self, "Data Error", f"Data from Excel file '{os.path.basename(self.loaded_excel_file_path)}' seems empty or wasn't loaded correctly. Please re-load the file."); return
            elif "Google Sheet URL" in data_source_type_selected:
                if self.data_content_from_file_or_url and self.loaded_google_sheet_url: 
                    data_source_content_str = self.data_content_from_file_or_url.strip()
                    try: # Shorten GSheet URL for logging
                        gsheet_id_part_for_log = self.loaded_google_sheet_url.split('/d/')[1].split('/')[0]
                        source_description_for_log_msg = f"Google Sheet: ...{gsheet_id_part_for_log[-20:]}"
                    except IndexError: source_description_for_log_msg = "Google Sheet (URL format issue)"
                elif self.google_sheet_url_field.text().strip(): # URL entered but not fetched
                    QMessageBox.warning(self, "Data Error", "Data from the Google Sheet URL is not loaded or is empty. Please click 'Fetch GSheet Data' first."); return
    
            # --- Email Job Creation Loop ---
            # This loop processes either the single UI email or all rows from the data source,
            # creating fully prepared email job dictionaries.
            
            prepared_jobs_count_this_action = 0
            total_recipients_for_this_action_log = [] 
    
            # Case 1: Processing bulk data (CSV, Excel, GSheet)
            if data_source_content_str:
                # Validate 'To' field usage for bulk data
                uses_placeholder_in_to_field = re.search(r"\{\{.*?\}\}", base_to_recipients_template_ui)
                custom_headers_are_enabled = hasattr(self, 'enable_custom_headers_checkbox') and self.enable_custom_headers_checkbox.isChecked()
                custom_to_header_is_present = False
                if custom_headers_are_enabled:
                    custom_headers_text_lower = self.custom_headers_text_input.toPlainText().lower()
                    if "to:" in custom_headers_text_lower: custom_to_header_is_present = True
                
                if not uses_placeholder_in_to_field and not custom_to_header_is_present:
                    QMessageBox.warning(self, "Bulk Data Configuration Error", 
                                        "When using a data source (CSV, Excel, GSheet), the 'To:' field in 'Recipients Configuration' must use a data placeholder (e.g., {{email_column_header}}), "
                                        "OR the 'To:' field must be explicitly defined in 'Custom Email Headers'."); 
                    return

                try: # Parse CSV data (from paste, Excel, or GSheet)
                    csv_file_like_object = io.StringIO(data_source_content_str)
                    csv_dict_reader = csv.DictReader(csv_file_like_object) # Easier to work with dicts per row
                    
                    # Clean fieldnames (headers) for consistent placeholder access (lowercase, spaces to underscores)
                    # csv_dict_reader.fieldnames are original headers. We'll clean them for keys in row_dict.
                    if not csv_dict_reader.fieldnames:
                         QMessageBox.warning(self, "Data Error", f"The data from '{source_description_for_log_msg}' is empty or has no header row."); return
                    
                    cleaned_fieldnames_for_keys = [str(h).strip().lower().replace(' ', '_') for h in csv_dict_reader.fieldnames]
                    if not any(h for h in cleaned_fieldnames_for_keys): 
                        QMessageBox.warning(self, "Data Error", f"The header row in data from '{source_description_for_log_msg}' is effectively empty after cleaning. Cannot process."); return
    
                    for row_num, raw_row_dict_from_reader in enumerate(csv_dict_reader, 1):
                        if not any(val.strip() for val in raw_row_dict_from_reader.values()): 
                            self.append_message_to_log_area(f"<font color='orange'>Info (Data Row {row_num} in '{source_description_for_log_msg}'): Empty row skipped.</font>"); continue
                        
                        # Create a data dictionary for this row using cleaned headers as keys
                        # and stripping values from the raw_row_dict.
                        data_dict_for_this_row = {
                            cleaned_fieldnames_for_keys[i]: str(raw_row_dict_from_reader[original_header]).strip()
                            for i, original_header in enumerate(csv_dict_reader.fieldnames) # Iterate using original headers to access raw_row_dict
                        }
                        
                        # Cycle through selected sender accounts for load balancing
                        current_sender_account_config = None
                        if "Apps Script" in send_method_str: current_sender_account_config = next(as_account_cycler_iter)
                        elif "Generic SMTP" in send_method_str: current_sender_account_config = next(generic_smtp_server_cycler_iter)

                        if not current_sender_account_config: # Should not happen if initial checks passed
                             self.append_message_to_log_area(f"<font color='red'>Critical Error (Data Row {row_num}): No valid sending account available in cycler. Halting campaign preparation.</font>"); return

                        # Resolve 'To' field using this row's data to get initial recipient list
                        # For `_resolve_all_placeholders_and_tags`, job context and cache are empty at this initial resolution.
                        to_field_resolved_with_row_data = self._resolve_all_placeholders_and_tags(base_to_recipients_template_ui, data_dict_for_this_row, {}, {})
                        initial_to_emails_list = self._parse_recipients(to_field_resolved_with_row_data)
                        
                        if not initial_to_emails_list and not custom_to_header_is_present:
                             self.append_message_to_log_area(f"<font color='orange'>Warning (Data Row {row_num}): 'To' field resolved to no valid emails ('{to_field_resolved_with_row_data}') and no custom 'To:' header is defined. Skipping this row.</font>"); continue

                        # Create the fully prepared email job dictionary
                        # This is where all placeholders, tags, and spintax are resolved.
                        prepared_email_job = self.create_fully_prepared_email_job(
                            initial_to_emails_list=initial_to_emails_list, # Can be empty if custom 'To:' header will define it
                            subject_template=all_subject_templates_from_ui[prepared_jobs_count_this_action % len(all_subject_templates_from_ui)],
                            from_name_template=all_from_name_templates_from_ui[prepared_jobs_count_this_action % len(all_from_name_templates_from_ui)],
                            body_html_template=body_html_template_from_ui,
                            body_plain_template=body_plain_template_from_ui,
                            row_data_dict=data_dict_for_this_row, 
                            send_method_type=send_method_str, # e.g., "Google Apps Script"
                            sender_account_config=current_sender_account_config # Dict of AS or SMTP server config
                        )
                        
                        if prepared_email_job and prepared_email_job.get('recipients_to_list'):
                            # Add log identifier details for tracking this job
                            prepared_email_job['log_identifier_details'] = {
                                'job_id_short': prepared_email_job['job_id'][:8],
                                'recipient': prepared_email_job['recipients_to_list'][0], # First recipient for concise log
                                'source_type': "DataList",
                                'source_detail': f"Row {row_num}" # 1-indexed data row
                            }
                            self.email_job_queue.append(prepared_email_job)
                            prepared_jobs_count_this_action += 1
                            total_recipients_for_this_action_log.extend(prepared_email_job['recipients_to_list'])
                        elif prepared_email_job and not prepared_email_job.get('recipients_to_list'):
                            self.append_message_to_log_area(f"<font color='orange'>Warning (Data Row {row_num}): Job was prepared, but final recipient list is empty (check custom 'To:' header resolution with this row's data). Skipping.</font>")
                        else: # Job creation failed, error logged by create_fully_prepared_email_job
                             self.append_message_to_log_area(f"<font color='red'>Failed to prepare email job for data row {row_num}. See console/terminal for detailed errors.</font>")

                except Exception as e: # Catch errors during CSV parsing or row processing
                    import traceback
                    error_msg_full = f"Error processing data from '{source_description_for_log_msg}':\n{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
                    QMessageBox.critical(self, "Data List Processing Error", error_msg_full)
                    self.append_message_to_log_area(f"<font color='red'>CRITICAL ERROR processing data list: {str(e)}. Campaign preparation halted.</font>")
                    return # Stop further processing
            
            # Case 2: Single email send (no data source content provided)
            else: 
                current_sender_account_config = None
                if "Apps Script" in send_method_str: current_sender_account_config = next(as_account_cycler_iter) if selected_as_accounts_list else None
                elif "Generic SMTP" in send_method_str: current_sender_account_config = next(generic_smtp_server_cycler_iter) if selected_generic_smtp_servers_list else None
                
                if not current_sender_account_config: # Should be caught by initial validation
                    QMessageBox.warning(self, "Configuration Error", "No sending account available for single send (this should have been caught earlier).")
                    return

                initial_to_emails_list = self._parse_recipients(base_to_recipients_template_ui) 
                # Check if 'To' is defined either in UI field or custom headers
                custom_headers_are_enabled_single = hasattr(self, 'enable_custom_headers_checkbox') and self.enable_custom_headers_checkbox.isChecked()
                custom_to_header_is_present_single = False
                if custom_headers_are_enabled_single:
                    custom_headers_text_lower = self.custom_headers_text_input.toPlainText().lower()
                    if "to:" in custom_headers_text_lower: custom_to_header_is_present_single = True

                if not initial_to_emails_list and not custom_to_header_is_present_single:
                     QMessageBox.warning(self, "Invalid 'To' Field", f"No valid 'To' email addresses found in 'Recipients' field ('{base_to_recipients_template_ui}') and no 'To:' custom header defined for this single send. Please provide recipients."); return

                # Create the fully prepared email job
                prepared_email_job = self.create_fully_prepared_email_job(
                    initial_to_emails_list=initial_to_emails_list,
                    subject_template=all_subject_templates_from_ui[0], # First subject for single send
                    from_name_template=all_from_name_templates_from_ui[0],   # First from name template
                    body_html_template=body_html_template_from_ui,
                    body_plain_template=body_plain_template_from_ui,
                    row_data_dict={}, # Empty data dict for single email (no CSV/data placeholders)
                    send_method_type=send_method_str,
                    sender_account_config=current_sender_account_config
                )

                if prepared_email_job and prepared_email_job.get('recipients_to_list'):
                    prepared_email_job['log_identifier_details'] = {
                        'job_id_short': prepared_email_job['job_id'][:8],
                        'recipient': prepared_email_job['recipients_to_list'][0],
                        'source_type': "SingleUI",
                        'source_detail': "-" # No specific detail for single UI send
                    }
                    self.email_job_queue.append(prepared_email_job)
                    prepared_jobs_count_this_action += 1
                    total_recipients_for_this_action_log.extend(prepared_email_job['recipients_to_list'])
                elif prepared_email_job and not prepared_email_job.get('recipients_to_list'):
                     self.append_message_to_log_area(f"<font color='orange'>Warning (Single Send): Job was prepared, but final recipient list is empty (check custom 'To:' header if used). Not added to queue.</font>")
                else: # Job creation failed
                    self.append_message_to_log_area(f"<font color='red'>Failed to prepare email job for the single send attempt. Check console/terminal for errors.</font>")
    
            # Log summary of this "Prepare Campaign" action
            if prepared_jobs_count_this_action > 0:
                unique_recipients_preview_list = list(set(total_recipients_for_this_action_log))
                log_recipients_summary_str = ", ".join(unique_recipients_preview_list[:3]) # Show first 3 unique
                if len(unique_recipients_preview_list) > 3: 
                    log_recipients_summary_str += f", ... ({len(unique_recipients_preview_list)} total unique recipients in this batch)"
                
                self.status_bar.showMessage(f"{prepared_jobs_count_this_action} email job(s) prepared and added to queue. Total in queue now: {len(self.email_job_queue)}", 7000)
                self.append_message_to_log_area(f"<i><b>{prepared_jobs_count_this_action} email job(s)</b> successfully prepared from '{source_description_for_log_msg}' and added to the main processing queue. (Recipients example for this addition: {log_recipients_summary_str})</i>")
            
            # Specific messages if no jobs were added from various scenarios
            elif data_source_content_str and prepared_jobs_count_this_action == 0: 
                self.append_message_to_log_area(f"<font color='red'>No email jobs were added from the data source '{source_description_for_log_msg}'. Please check your data, 'To' field placeholders, custom headers, and any warnings in this log.</font>")
            elif not data_source_content_str and prepared_jobs_count_this_action == 0 and \
                 (self.to_field_input.text().strip() or \
                  (hasattr(self, 'enable_custom_headers_checkbox') and self.enable_custom_headers_checkbox.isChecked() and self.custom_headers_text_input.toPlainText().strip())): 
                self.append_message_to_log_area(f"<font color='red'>No email job was added for the single send attempt. Please check your 'To' field, custom headers, and any warnings.</font>")
            # If no inputs and no data list, no specific message needed, as user likely didn't intend to add anything.
    
            self.update_queue_control_buttons_state()
            self.refresh_performance_stats_display() # Update queue count on display


    def dispatch_single_test_email(self, target_test_email_address, base_job_config_for_test):
            """Prepares and dispatches a single test email based on a provided base job configuration.
            The test email content is modified to clearly indicate it's a test.
            This runs in a separate, short-lived OptimizedEmailSenderThread.
            """
            if not base_job_config_for_test or not isinstance(base_job_config_for_test, dict):
                self.append_message_to_log_area("<font color='red'>❌ Error: Cannot send test email. Base job configuration is invalid or missing.</font>")
                return

            original_job_id_for_log = base_job_config_for_test.get('job_id', 'UNKNOWN_ORIGINAL_ID')
            self.append_message_to_log_area(f"🧪 Preparing test email to {target_test_email_address}, based on content of Job ID: {original_job_id_for_log[:8]}...")
    
            test_job_payload_dict = {}
            try:
                import copy
                
                # --- CORRECTED DEEPCOPY HANDLING FOR RATE LIMITER ---
                # 1. Store the original rate limiter if it exists, then remove it before deepcopying.
                original_rate_limiter_for_test_job = base_job_config_for_test.get('rate_limiter')
                
                # Create a temporary dict for deepcopying, excluding the rate_limiter
                temp_dict_for_deepcopy = {
                    k: v for k, v in base_job_config_for_test.items() if k != 'rate_limiter'
                }
                
                # Deepcopy the rest of the dictionary
                test_job_payload_dict = copy.deepcopy(temp_dict_for_deepcopy)
                
                # The rate_limiter for the test job will be handled separately later if needed.
                # For a single test email, often you might not even need the original rate limiter,
                # or you might want to use a different one or none at all.
                # If you *do* need to pass the original rate limiter object (not a copy) to the test thread,
                # you can re-assign it after the deepcopy if it's relevant for the test.
                # However, the OptimizedEmailSenderThread already takes rate_limiters_pool as an argument,
                # and the specific limiter is attached within its run() method if the job is SMTP.
                # So, we might not need to explicitly carry 'rate_limiter' in the test_job_payload_dict itself.
                
                # For clarity, ensure 'rate_limiter' key is not in the test_job_payload_dict after deepcopy,
                # as it will be handled by the OptimizedEmailSenderThread constructor's rate_limiters_pool argument.
                if 'rate_limiter' in test_job_payload_dict:
                    del test_job_payload_dict['rate_limiter']

                # Remove log_identifier_details as it will be reset for the test
                if 'log_identifier_details' in test_job_payload_dict:
                    del test_job_payload_dict['log_identifier_details']
                
            except Exception as e:
                self.append_message_to_log_area(f"<font color='red'>❌ Error creating test payload (deepcopy failed): {e}.</font>")
                # print(traceback.format_exc()) # For more detailed console debugging if needed
                return

            # --- Modify payload specifically for the test email ---
            test_job_payload_dict['job_id'] = f"TEST_{str(uuid.uuid4())[:10]}" 
            test_job_payload_dict['status'] = "Sending Test Email..."
            test_job_payload_dict['recipients_to_list'] = [target_test_email_address] 
    
            custom_headers_key_in_payload = 'all_custom_headers' 
            if custom_headers_key_in_payload not in test_job_payload_dict or not isinstance(test_job_payload_dict[custom_headers_key_in_payload], dict):
                test_job_payload_dict[custom_headers_key_in_payload] = {}
            test_job_payload_dict[custom_headers_key_in_payload]['To'] = target_test_email_address 
            for key_to_remove in ['Cc', 'cc', 'Bcc', 'bcc']:
                test_job_payload_dict[custom_headers_key_in_payload].pop(key_to_remove, None)
    
            if test_job_payload_dict.get("type") == "appsscript":
                as_specific_custom_headers_key = 'custom_headers_dict'
                if as_specific_custom_headers_key not in test_job_payload_dict or not isinstance(test_job_payload_dict[as_specific_custom_headers_key], dict):
                    test_job_payload_dict[as_specific_custom_headers_key] = {}
                test_job_payload_dict[as_specific_custom_headers_key] = {
                    k: v for k, v in test_job_payload_dict[as_specific_custom_headers_key].items()
                    if k.lower() not in ['to', 'subject', 'from', 'cc', 'bcc'] 
                }

            test_subject_prefix = f"[AUTO-TEST MAIL - Job {original_job_id_for_log[:8]}] "
            test_job_payload_dict['subject'] = test_subject_prefix + test_job_payload_dict.get('subject', "Test Notification from Mailer")
            
            test_body_indicator_html_str = f"<p style='color:red; font-weight:bold; border:1px dashed red; padding:5px;'>--- THIS IS AN AUTOMATED TEST EMAIL (Based on original Job ID: {original_job_id_for_log[:8]}) ---</p><hr><br>"
            test_body_indicator_plain_str = f"--- THIS IS AN AUTOMATED TEST EMAIL (Based on original Job ID: {original_job_id_for_log[:8]}) ---\n---------------------------------\n\n"
    
            test_job_payload_dict['htmlBody'] = test_body_indicator_html_str + (test_job_payload_dict.get('htmlBody', "") or "")
            test_job_payload_dict['plainBody'] = test_body_indicator_plain_str + (test_job_payload_dict.get('plainBody', "") or "")
            
            if not test_job_payload_dict.get('htmlBody', "").replace(test_body_indicator_html_str, "").strip() and \
               not test_job_payload_dict.get('plainBody', "").replace(test_body_indicator_plain_str, "").strip():
                default_test_msg_content = f"This is a test email message based on the content and configuration of main email job ID: {original_job_id_for_log}. If you see this, the sending mechanism is likely working."
                test_job_payload_dict['plainBody'] += default_test_msg_content
                test_job_payload_dict['htmlBody'] += f"<p>{default_test_msg_content}</p>"
    
            test_job_payload_dict['log_identifier_details'] = {
                'job_id_short': test_job_payload_dict['job_id'][:8],
                'recipient': target_test_email_address,
                'source_type': "AUTO-TEST", 
                'source_detail': f"OrigJob:{original_job_id_for_log[:8]}"
            }
            
            self.append_message_to_log_area(f"📧 Dispatching Automated Test Email (ID: {test_job_payload_dict['job_id']}) via {test_job_payload_dict.get('type', 'N/A')} to {target_test_email_address}")
            self.status_bar.showMessage(f"📧 Sending automated test email to {target_test_email_address}...", 0)
            
            sender_config_for_test_thread = {'max_concurrent_tasks_in_batch': 1, 'proxy_dict': self.get_active_proxy_config_dict()}
            
            # Rate limiter for the test:
            # The OptimizedEmailSenderThread will pick the correct rate limiter from the self.rate_limiters_pool
            # based on the 'nickname' present in the test_job_payload_dict (which was copied from base_job_config_for_test).
            # So, we pass the entire pool.
            rate_limiters_for_test_thread_pool = self.rate_limiters_pool 
    
            test_email_sender_thread = OptimizedEmailSenderThread(
                [test_job_payload_dict], 
                sender_config_for_test_thread, 
                rate_limiters_for_test_thread_pool # Pass the whole pool
            )
            test_email_sender_thread.setObjectName(f"TestEmailWorker-{test_job_payload_dict['job_id'][:8]}")
            
            test_email_sender_thread.send_status_signal.connect(self.update_status_bar_message_from_thread) 
            test_email_sender_thread.send_finished_signal.connect(self.on_test_email_worker_finished) 
            
            self.active_test_email_workers.append(test_email_sender_thread)
            test_email_sender_thread.start()
    

    def closeEvent(self, event):
            """Handles the application close event gracefully, ensuring threads are stopped."""
            print("CloseEvent: Application close requested by user or system.")
            
            utility_threads_are_stopped = True
            # Stop Gemini subject generation thread if active
            if self.gemini_subject_gen_thread_instance and self.gemini_subject_gen_thread_instance.isRunning():
                print("CloseEvent: Attempting to stop Gemini Subject Generator thread...")
                self.gemini_subject_gen_thread_instance.stop() # Signal thread to stop
                if not self.gemini_subject_gen_thread_instance.wait(2500): # Wait 2.5 seconds
                    print("Warning (CloseEvent): Gemini thread did not stop cleanly within timeout. May need forceful termination if problematic.")
                    utility_threads_are_stopped = False
                else:
                    print("CloseEvent: Gemini thread stopped successfully.")
                self.gemini_subject_gen_thread_instance.deleteLater()
                self.gemini_subject_gen_thread_instance = None
    
            # Stop Google Sheet fetching thread if active
            if self.sheet_fetcher_thread_instance and self.sheet_fetcher_thread_instance.isRunning():
                print("CloseEvent: Attempting to stop Sheet Fetcher thread...")
                self.sheet_fetcher_thread_instance.stop() # Signal thread to stop
                if not self.sheet_fetcher_thread_instance.wait(2500):
                    print("Warning (CloseEvent): Sheet Fetcher thread did not stop cleanly within timeout.")
                    utility_threads_are_stopped = False
                else:
                    print("CloseEvent: Sheet Fetcher thread stopped successfully.")
                self.sheet_fetcher_thread_instance.deleteLater()
                self.sheet_fetcher_thread_instance = None
    
            # Check if email sending workers (batch or test) are active
            is_any_email_sending_active = self.queue_processing_active or self.active_batch_send_workers or self.active_test_email_workers
            total_active_email_workers = len(self.active_batch_send_workers) + len(self.active_test_email_workers)
    
            if is_any_email_sending_active:
                reply = QMessageBox.question(
                    self, 'Confirm Exit Application',
                    f"Email processing is currently active or email worker threads might still be running ({total_active_email_workers} active worker(s)).\n"
                    "Stopping them might take a moment to ensure data integrity and clean shutdown.\n\n"
                    "Do you want to stop all processing and exit the application?",
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.No 
                )
                
                if reply == QMessageBox.Yes:
                    self.status_bar.showMessage("Attempting graceful shutdown of all active worker threads... Please wait.", 0) # Persistent
                    QApplication.processEvents() # Allow UI to update the status message
    
                    self.queue_processing_active = False # Prevent new batches from being dispatched
                    self.is_paused_flag = True # Further reinforce stopping
    
                    # Consolidate all active email workers for shutdown
                    all_email_workers_to_stop_gracefully = list(self.active_batch_send_workers) + list(self.active_test_email_workers)
                    
                    # Clear main lists immediately to prevent race conditions with finish signals
                    self.active_batch_send_workers.clear()
                    self.active_test_email_workers.clear()
    
                    print(f"CloseEvent: Signalling {len(all_email_workers_to_stop_gracefully)} email worker(s) to stop...")
                    for worker in all_email_workers_to_stop_gracefully:
                        if hasattr(worker, 'stop'): worker.stop() # Call non-blocking stop()
    
                    print(f"CloseEvent: Waiting for {len(all_email_workers_to_stop_gracefully)} email worker(s) to finish their run methods...")
                    # Total wait time can be significant if many workers or long-running tasks.
                    # Consider a more interactive progress dialog for very long shutdowns if necessary.
                    timeout_per_worker_ms = 7500 # 7.5 seconds per worker
    
                    for i, worker in enumerate(all_email_workers_to_stop_gracefully):
                        worker_name = worker.objectName() if worker.objectName() else f"UnnamedWorker-{i}"
                        print(f"CloseEvent: Waiting for email worker {i+1}/{len(all_email_workers_to_stop_gracefully)} ({worker_name})...")
                        worker.quit() # Signal Qt's event loop for the thread to prepare for exit
                        if not worker.wait(timeout_per_worker_ms): 
                            print(f"Warning (CloseEvent): Email worker thread {worker_name} did not finish its run method cleanly after {timeout_per_worker_ms}ms during application close. It might be stuck or have terminated ungracefully.")
                        else:
                            print(f"CloseEvent: Email worker {worker_name} finished its run method.")
                        worker.deleteLater() # Schedule for Qt's garbage collection
                    
                    print("CloseEvent: All active email workers have been processed for shutdown.")
                    self.save_application_settings() # <--- CORRECTED METHOD NAME
                    event.accept() # Proceed with closing the application
                else: # User chose not to exit
                    event.ignore() 
                    self.status_bar.showMessage("Application exit cancelled by user.", 3000)
            else: # No active email sending, check utility threads and proceed
                if not utility_threads_are_stopped:
                    QMessageBox.warning(self, "Shutdown Notice", "Some background utility threads (e.g., AI, Sheet Fetcher) did not stop cleanly, but no email sending was active. Proceeding with exit.")
                
                print("CloseEvent: No active email sending workers. Saving settings and exiting.")
                self.save_application_settings() # <--- CORRECTED METHOD NAME
                event.accept() # Proceed with closing
    
    

    def replace_placeholders_in_text(self, text_template, data_row_dict, original_headers_list=None):
        """(Retained for compatibility if used by older logic, but _resolve_all_placeholders_and_tags is preferred)
        Replace placeholders in text with data from CSV/data_row_dict.
        `data_row_dict` keys should be cleaned (lowercase, underscore for space).
        """
        if not text_template or not data_row_dict: return text_template
        
        processed_text = str(text_template)
        for cleaned_header_key, value_from_data in data_row_dict.items():
            placeholder_pattern = r"\{\{\s*" + re.escape(cleaned_header_key) + r"\s*\}\}"
            try:
                processed_text = re.sub(placeholder_pattern, str(value_from_data), processed_text, flags=re.IGNORECASE)
            except re.error as e:
                print(f"Regex error in replace_placeholders_in_text for key '{cleaned_header_key}': {e}")
        return processed_text


    def get_email_body_content_templates(self):
        """Get email body templates (HTML and plain text) based on UI format selection."""
        selected_body_format = self.body_format_type_combo.currentText()
        html_template = None
        plain_template = None
        
        raw_text_from_body_input = self.email_body_text_input.toPlainText()
        
        if "Rich Text" in selected_body_format:
            if not self.email_body_text_input.document().isEmpty(): # Check if editor has content
                html_template = self.email_body_text_input.toHtml()
                # For plain text from rich editor, use html2text for consistency with Raw HTML mode.
                # Qt's toPlainText() from rich text can sometimes be basic.
                if html_template:
                    try: plain_template = self.html_to_text_converter.handle(html_template)
                    except Exception as e:
                        print(f"Warning: Error converting rich text to plain using html2text: {e}. Falling back to Qt's toPlainText().")
                        plain_template = self.email_body_text_input.toPlainText() 
        elif "Raw HTML" in selected_body_format:
            html_template = raw_text_from_body_input
            if html_template:
                try: plain_template = self.html_to_text_converter.handle(html_template)
                except Exception as e:
                    print(f"Error converting Raw HTML to plain text: {e}")
                    plain_template = f"--- Plain text version could not be generated from the provided HTML ---\n\n{raw_text_from_body_input[:1000]}" # Fallback
        elif "Plain Text" in selected_body_format:
            plain_template = raw_text_from_body_input
            # Optionally, create a very basic HTML version from plain text if required by all senders.
            # Most email clients handle `text/plain` only emails well.
            # If HTML is always needed:
            # html_template = f"<pre>{plain_template}</pre>" # Preserves line breaks and spacing
            # Or: html_template = f"<p>{plain_template.replace('\n', '<br>')}</p>" # Basic paragraph
        
        return html_template, plain_template


    def create_fully_prepared_email_job(self, initial_to_emails_list, subject_template, from_name_template, 
                                                body_html_template, body_plain_template, 
                                                row_data_dict, # Data from CSV/Excel for this specific email
                                                send_method_type, sender_account_config):
                """Creates a single, fully prepared email job dictionary.
                This is where all placeholders, dynamic tags, and spintax are resolved for an individual email.
                Args:
                    initial_to_emails_list (list): Parsed 'To' recipients (can be empty if custom 'To' header is used).
                    subject_template (str): Subject line template.
                    from_name_template (str): 'From Name' display template.
                    body_html_template (str|None): HTML body template.
                    body_plain_template (str|None): Plain text body template.
                    row_data_dict (dict): Dictionary of data for the current row (e.g., from CSV). Empty for single UI sends.
                    send_method_type (str): Type of sending method (e.g., "Google Apps Script", "Generic SMTP Server").
                    sender_account_config (dict): Configuration of the specific AS account or SMTP server to be used.
                Returns:
                    dict|None: A fully prepared email job dictionary, or None if a critical error occurs.
                """
                generated_job_id = str(uuid.uuid4())
                try:
                    if not sender_account_config: # Guard against missing sender config
                        print(f"Critical Error (Job ID precursor {generated_job_id}): sender_account_config is missing. Cannot prepare job.")
                        return None
    
                    # Cache for boundary tags ({{[bnd...]}}) specific to this job, ensuring they are same for this email.
                    boundary_tag_cache_for_this_job = {} 
        
                    # --- Initial Job Context Dictionary (for tag resolution) ---
                    current_primary_recipient_for_context = initial_to_emails_list[0] if initial_to_emails_list else ""
                    
                    job_specific_context_dict = {
                        "email_id": generated_job_id, 
                        "current_recipient_email": current_primary_recipient_for_context,
                    }
    
                    # Add sender-specific details to context
                    account_type = sender_account_config.get('type') 
                    if not account_type: 
                        if 'web_app_url' in sender_account_config: account_type = 'appsscript'
                        elif 'host' in sender_account_config: account_type = 'genericsmtp'
                    
                    if account_type == 'appsscript':
                        job_specific_context_dict['script_user_email'] = sender_account_config.get('email')
                        job_specific_context_dict['smtp_server_nickname_for_tag'] = sender_account_config.get('nickname', sender_account_config.get('email')) 
                    elif account_type == 'genericsmtp':
                        job_specific_context_dict['smtp_username_for_tag'] = sender_account_config.get('username', '')
                        job_specific_context_dict['smtp_server_nickname_for_tag'] = sender_account_config.get('nickname', sender_account_config.get('host'))
        
                    # --- Resolve main email components ---
                    subject_after_placeholders_tags = self._resolve_all_placeholders_and_tags(subject_template, row_data_dict, job_specific_context_dict, boundary_tag_cache_for_this_job)
                    final_resolved_subject = self.process_spintax_in_text(subject_after_placeholders_tags) or "No Subject"
                    job_specific_context_dict["current_subject_for_job"] = final_resolved_subject
        
                    from_name_after_placeholders_tags = self._resolve_all_placeholders_and_tags(from_name_template, row_data_dict, job_specific_context_dict, boundary_tag_cache_for_this_job)
                    final_resolved_from_name_display = self.process_spintax_in_text(from_name_after_placeholders_tags)
                    job_specific_context_dict["current_from_name_for_job"] = final_resolved_from_name_display
                    
                    final_resolved_body_html = None
                    if body_html_template:
                        html_body_after_placeholders_tags = self._resolve_all_placeholders_and_tags(body_html_template, row_data_dict, job_specific_context_dict, boundary_tag_cache_for_this_job)
                        final_resolved_body_html = self.process_spintax_in_text(html_body_after_placeholders_tags)
                    
                    final_resolved_body_plain = None
                    if body_plain_template:
                        plain_body_after_placeholders_tags = self._resolve_all_placeholders_and_tags(body_plain_template, row_data_dict, job_specific_context_dict, boundary_tag_cache_for_this_job)
                        final_resolved_body_plain = self.process_spintax_in_text(plain_body_after_placeholders_tags)
                    elif final_resolved_body_html and not body_plain_template: 
                        try: final_resolved_body_plain = self.html_to_text_converter.handle(final_resolved_body_html)
                        except Exception as e:
                            print(f"Warning (Job {generated_job_id}): Could not auto-generate plain text from resolved HTML: {e}")
                            final_resolved_body_plain = "Please view this email in an HTML-compatible email client."
        
                    # --- Base Email Job Structure ---
                    email_job_dict = {
                        'job_id': generated_job_id,
                        'recipients_to_list': list(initial_to_emails_list) if initial_to_emails_list else [], 
                        'subject': final_resolved_subject, 
                        'htmlBody': final_resolved_body_html,
                        'plainBody': final_resolved_body_plain,
                        'status': 'PendingPreparation', 
                        'all_custom_headers': {} 
                    }
                    email_job_dict.update(sender_account_config.copy()) # Copy base sender config
    
                    # Determine and set the job 'type' based on send_method_type (more reliable than inferring from sender_account_config alone)
                    if "Apps Script" in send_method_type: email_job_dict['type'] = 'appsscript'
                    elif "Generic SMTP" in send_method_type: email_job_dict['type'] = 'genericsmtp'
                    else:
                        print(f"Warning (Job {generated_job_id}): Unknown send_method_type '{send_method_type}'. Job type may be incorrect.")
                        # Fallback to inferred type if primary check fails
                        email_job_dict['type'] = account_type if account_type else 'unknown'
    
    
                    # --- Process Custom Headers ---
                    if hasattr(self, 'enable_custom_headers_checkbox') and self.enable_custom_headers_checkbox.isChecked():
                        custom_headers_template_text_ui = self.custom_headers_text_input.toPlainText().strip()
                        resolved_custom_headers_dict = {}
                        if custom_headers_template_text_ui: 
                            for line_template in custom_headers_template_text_ui.split('\n'):
                                line_template = line_template.strip()
                                if ':' in line_template:
                                    header_name_template_str, header_value_template_str = line_template.split(':', 1)
                                    header_name_final = header_name_template_str.strip() 
                                    header_value_template_str = header_value_template_str.strip()
                                    
                                    value_after_placeholders_tags = self._resolve_all_placeholders_and_tags(header_value_template_str, row_data_dict, job_specific_context_dict, boundary_tag_cache_for_this_job)
                                    final_resolved_header_value = self.process_spintax_in_text(value_after_placeholders_tags)
                                    resolved_custom_headers_dict[header_name_final] = final_resolved_header_value
                            
                            email_job_dict['all_custom_headers'] = resolved_custom_headers_dict
                            
                            custom_subject_from_headers = resolved_custom_headers_dict.get('Subject', resolved_custom_headers_dict.get('subject'))
                            if custom_subject_from_headers is not None: 
                                email_job_dict['subject'] = custom_subject_from_headers
                            
                            custom_to_value_from_headers = resolved_custom_headers_dict.get('To', resolved_custom_headers_dict.get('to'))
                            if custom_to_value_from_headers is not None:
                                new_recipients_list_from_header = self._parse_recipients(custom_to_value_from_headers)
                                if new_recipients_list_from_header:
                                    email_job_dict['recipients_to_list'] = new_recipients_list_from_header
                                    job_specific_context_dict["current_recipient_email"] = new_recipients_list_from_header[0] 
                                else: 
                                    print(f"Warning (Job ID {generated_job_id}): Custom 'To:' header ('{custom_to_value_from_headers}') resolved to no valid emails.")
                    
                    # --- Finalize Sender-Specific Fields based on job type ---
                    if email_job_dict.get('type') == 'appsscript':
                        custom_from_header_value = email_job_dict['all_custom_headers'].get('From', email_job_dict['all_custom_headers'].get('from'))
                        
                        if custom_from_header_value:
                            match_from_header = re.match(r'^(.*?)<([^<>]+)>$', custom_from_header_value.strip())
                            if match_from_header: 
                                email_job_dict['sender_display_name'] = match_from_header.group(1).strip().strip('"')
                            else: 
                                email_job_dict['sender_display_name'] = custom_from_header_value.strip()
                        elif final_resolved_from_name_display: 
                            email_job_dict['sender_display_name'] = final_resolved_from_name_display
                        elif sender_account_config.get('sender_display_name'): 
                            email_job_dict['sender_display_name'] = sender_account_config.get('sender_display_name')
                        
                        email_job_dict['custom_headers_dict'] = {
                            k:v for k,v in email_job_dict['all_custom_headers'].items() 
                            if k.lower() not in ['to', 'subject', 'from', 'cc', 'bcc']
                        }
        
                    elif email_job_dict.get('type') == 'genericsmtp':
                        custom_from_header_value_smtp = email_job_dict['all_custom_headers'].get('From', email_job_dict['all_custom_headers'].get('from'))
                        if custom_from_header_value_smtp:
                            email_job_dict['from_address'] = custom_from_header_value_smtp 
                        else: 
                            email_job_dict['from_address'] = self.build_smtp_from_address(final_resolved_from_name_display, sender_account_config)
                    
                    if not email_job_dict.get('recipients_to_list'):
                        print(f"Critical Warning (Job ID {generated_job_id}): Final recipient list for this job is empty. This job may not be sent or may cause errors during sending.")
        
                    email_job_dict['status'] = 'Prepared' 
                    return email_job_dict 
        
                except Exception as e:
                    import traceback
                    job_id_for_error = generated_job_id if 'generated_job_id' in locals() else 'N/A_ID_PRE_INIT'
                    print(f"CRITICAL ERROR during email job preparation (Job ID precursor: {job_id_for_error}): {e}\n{traceback.format_exc()}")
                    return None
    
        

    def build_smtp_from_address(self, resolved_display_name_from_ui, smtp_server_config):
        """Builds the 'From' address string for SMTP, e.g., "Display Name <user@example.com>".
        Prioritizes server's configured `from_address` for the email part if available,
        otherwise uses `username`. Combines with `resolved_display_name_from_ui`.
        Args:
            resolved_display_name_from_ui (str): The resolved display name from UI content or data.
            smtp_server_config (dict): The SMTP server's configuration dictionary.
        Returns:
            str: The formatted 'From' address string for SMTP.
        """
        # Determine the email address part for the From header
        email_part_for_from = smtp_server_config.get('username', '').strip() # Default to username

        server_default_from_address_field = smtp_server_config.get('from_address', '').strip()
        if server_default_from_address_field:
            # If server_default_from_address_field is already "Name <email>", parse its email part.
            # Otherwise, assume it's just an email address.
            match_email_in_server_default = re.search(r'<([^<>]+)>', server_default_from_address_field)
            if match_email_in_server_default:
                email_part_for_from = match_email_in_server_default.group(1).strip()
            elif "@" in server_default_from_address_field: # Likely just an email address
                email_part_for_from = server_default_from_address_field
            # If server_default_from_address_field is just a name without email, ignore it for email_part.
        
        # Ensure a valid email part is found, otherwise use a placeholder.
        if not email_part_for_from or "@" not in email_part_for_from:
            fallback_email = "sender@mailer.app" # A generic fallback
            print(f"Warning: Could not determine a valid sender email for SMTP 'From' address using server config: '{smtp_server_config.get('nickname', 'Unnamed SMTP')}'. Defaulting to '{fallback_email}'. Check server's username or 'Default From Address' setting.")
            email_part_for_from = fallback_email

        # Format the final 'From' string using email.utils.formataddr for proper quoting etc.
        # If resolved_display_name_from_ui is provided, use it.
        if resolved_display_name_from_ui:
            return formataddr((resolved_display_name_from_ui, email_part_for_from))
        else: # No UI display name, check if server_default_from_address_field provided a name part
            if server_default_from_address_field and '<' in server_default_from_address_field:
                # If server_default_from_address_field was "Name <email>", use its name part
                match_name_in_server_default = re.match(r'^(.*?)<', server_default_from_address_field)
                if match_name_in_server_default:
                    name_part_from_server_default = match_name_in_server_default.group(1).strip().strip('"')
                    if name_part_from_server_default:
                        return formataddr((name_part_from_server_default, email_part_for_from))
            # If no display name from UI and no name part from server's default, just use the email address.
            return email_part_for_from


    def on_data_source_type_changed(self):
        """Handle data source type change in the UI (Paste, Excel, GSheet) and update stacked widget."""
        selected_index = self.data_source_type_combo.currentIndex()
        self.data_source_stacked_widget.setCurrentIndex(selected_index)

        # Update instruction label based on selected source type
        if selected_index == 0: # Paste CSV Data
            self.data_list_placeholder_instruction_label.setText("Paste CSV data (first line must be headers). Use placeholders like <b>{{HeaderNameFromData}}</b> in content fields (case-insensitive, spaces become underscores e.g. {{first_name}}).")
        elif selected_index == 1: # Load from Excel File
            self.data_list_placeholder_instruction_label.setText("Load data from an Excel file (first sheet's first row used as headers). Use <b>{{HeaderNameFromData}}</b> as placeholders (case-insensitive, spaces to underscores).")
        elif selected_index == 2: # Load from Google Sheet URL
            self.data_list_placeholder_instruction_label.setText("Fetch data from a Google Sheet URL (first row used as headers). Use <b>{{HeaderNameFromData}}</b> as placeholders (case-insensitive, spaces to underscores). Requires Apps Script setup for fetching.")


    def on_body_format_type_changed(self):
        """Handle email body format change (Rich Text, Raw HTML, Plain Text) in UI and adjust editor behavior."""
        selected_format_str = self.body_format_type_combo.currentText()
        
        # This logic is simplified. A more robust approach might involve temporarily storing
        # content and trying to convert it when switching formats, but that can be complex.
        # For now, it mainly changes placeholder text and rich text editing capability.

        if "Rich Text" in selected_format_str:
            self.email_body_text_input.setAcceptRichText(True) # Enable rich text editing features
            self.email_body_text_input.setPlaceholderText("Compose or paste rich text/HTML here. Use {{placeholders}} from data, {{[dynamic_tags]}}, and {spintax|options}. A formatting toolbar could be added for rich text editing.")
        elif "Raw HTML" in selected_format_str:
            self.email_body_text_input.setAcceptRichText(False) # Disable rich text, input is treated as plain text (raw HTML)
            self.email_body_text_input.setPlaceholderText("Paste your full HTML code here. Placeholders {{like_this}}, dynamic tags {{[tag]}}, and {spintax|options} are supported within the HTML. This input will be used as raw HTML for the email body.")
        elif "Plain Text" in selected_format_str:
            self.email_body_text_input.setAcceptRichText(False) # Input is plain text
            self.email_body_text_input.setPlaceholderText("Enter plain text email body. Placeholders {{like_this}}, dynamic tags {{[tag]}}, and {spintax|options} are supported. Line breaks will be preserved.")
        
        # self.email_body_text_input.setProperty("current_body_format", selected_format_str) # Store for potential future use


    def on_enable_custom_headers_toggled(self, is_checked):
        """Handle custom headers checkbox toggle in UI, enabling/disabling the input field."""
        self.custom_headers_text_input.setEnabled(is_checked)
        if is_checked:
            self.custom_headers_text_input.setToolTip("Enter custom headers, one per line (e.g., 'Reply-To: support@example.com').\nPlaceholders, tags, and spintax are supported in header VALUES.\nUsing 'To:', 'Subject:', or 'From:' here will OVERRIDE the main UI fields for those specific headers.")
        else:
            self.custom_headers_text_input.setToolTip("Custom headers are currently disabled. Check the box to enable.")


    def get_active_proxy_config_dict(self):
        """Get current proxy configuration as a dictionary for `requests` library, if enabled and valid."""
        # This method uses instance variables (self.proxy_is_enabled, etc.)
        # which should be kept in sync with UI elements and QSettings.
        
        if not self.proxy_is_enabled: return None # Proxy not enabled
        
        host = self.proxy_config_host
        port_str = self.proxy_config_port # Port is stored as string from settings/UI
        user = self.proxy_config_user
        password = self.proxy_config_pass
        proxy_type_lower = self.proxy_config_type.lower() 

        if not host or not port_str:
            # self.append_message_to_log_area("<font color='orange'>Proxy is enabled in settings, but host or port is missing. Proxy will not be used.</font>")
            return None
        
        try: # Validate port is a number
            port_int = int(port_str)
            if not (1 <= port_int <= 65535): raise ValueError("Port out of range")
        except ValueError:
            # self.append_message_to_log_area(f"<font color='orange'>Proxy port '{port_str}' is invalid. Proxy will not be used.</font>")
            return None
            
        proxy_url_base_part = f"{host}:{port_int}"
        if user and password: # Construct URL with authentication
            # Ensure user/pass are URL-encoded for safety in URL
            proxy_auth_part = f"{urllib.parse.quote_plus(user)}:{urllib.parse.quote_plus(password)}@"
            full_proxy_url_with_auth = f"{proxy_auth_part}{proxy_url_base_part}"
        else: # No authentication
            full_proxy_url_with_auth = proxy_url_base_part
        
        # Construct proxy dictionary for requests
        if "http" in proxy_type_lower: # Handles "HTTP" and "HTTPS" proxy types
            return {"http": f"http://{full_proxy_url_with_auth}", "https": f"http://{full_proxy_url_with_auth}"}
        elif "socks5" in proxy_type_lower:
            try:
                import socks # Test if PySocks is available (requests[socks] dependency)
                # 'socks5h' ensures DNS resolution happens through the proxy server
                return {"http": f"socks5h://{full_proxy_url_with_auth}", "https": f"socks5h://{full_proxy_url_with_auth}"}
            except ImportError:
                self.append_message_to_log_area("<font color='red'>SOCKS5 proxy selected, but 'PySocks' library is not installed (run: pip install requests[socks]). Proxy disabled for this session.</font>")
                if hasattr(self, 'proxy_enabled_checkbox_ref'): self.proxy_enabled_checkbox_ref.setChecked(False) # Disable in UI
                self.proxy_is_enabled = False # Update internal state
                return None
        elif "socks4" in proxy_type_lower: # Less common, but supportable
             try:
                import socks 
                return {"http": f"socks4h://{full_proxy_url_with_auth}", "https": f"socks4h://{full_proxy_url_with_auth}"}
             except ImportError:
                self.append_message_to_log_area("<font color='red'>SOCKS4 proxy selected, but 'PySocks' library not installed. Proxy disabled.</font>")
                if hasattr(self, 'proxy_enabled_checkbox_ref'): self.proxy_enabled_checkbox_ref.setChecked(False)
                self.proxy_is_enabled = False
                return None
        else:
            self.append_message_to_log_area(f"<font color='orange'>Unknown proxy type specified: '{self.proxy_config_type}'. Proxy will not be used.</font>")
            return None


    def populate_send_via_combo_from_settings(self):
        """Populate and set the 'Send Via' combo box based on saved application settings."""
        saved_send_method = self.settings.value(SEND_VIA_SETTING, "Google Apps Script") # Default if not set
        
        # Find the index of the saved method in the combo box items
        index_of_saved_method = self.send_via_combo_box.findText(saved_send_method, Qt.MatchFixedString) # Exact match
        
        if index_of_saved_method != -1: # If found, set it as current
            self.send_via_combo_box.setCurrentIndex(index_of_saved_method)
        else: # Saved value not in current options, default to the first item (usually Apps Script)
            self.send_via_combo_box.setCurrentIndex(0)
            print(f"Warning: Saved send method '{saved_send_method}' not found in UI options. Defaulting to '{self.send_via_combo_box.itemText(0)}'.")
        
        self.on_send_method_changed_update_visibility() # Ensure UI panels update accordingly


    # --- Excel and Google Sheets Integration ---
    def trigger_load_excel_file_dialog(self):
        """Open dialog to load an Excel file, read its first sheet, and convert to CSV string format."""
        if not PANDAS_AVAILABLE:
            QMessageBox.warning(self, "Feature Disabled", f"Excel import functionality requires the Pandas library.\nDetails: {PANDAS_IMPORT_ERROR}\nPlease install it (e.g., 'pip install pandas openpyxl') and restart the application.")
            if hasattr(self, 'load_excel_file_button'): self.load_excel_file_button.setEnabled(False)
            return

        file_dialog_options = QFileDialog.Options()
        # file_dialog_options |= QFileDialog.DontUseNativeDialog # Uncomment for testing non-native dialog on some systems
        
        default_dir = QStandardPaths.writableLocation(QStandardPaths.DocumentsLocation) # Start in Documents
        excel_file_path_tuple = QFileDialog.getOpenFileName(
            self, "Load Data from Excel File", default_dir,
            "Excel Files (*.xlsx *.xls);;All Files (*)", 
            options=file_dialog_options
        )
        chosen_file_path = excel_file_path_tuple[0] # getOpenFileName returns (filePath, filter)
        
        if chosen_file_path:
            self.status_bar.showMessage(f"Loading Excel file: {os.path.basename(chosen_file_path)}... Please wait.", 0) # Persistent
            QApplication.processEvents() # Ensure UI updates to show message

            try:
                # Determine pandas engine based on file extension for robustness
                excel_engine_to_use = 'openpyxl' if chosen_file_path.lower().endswith('.xlsx') else None # None lets pandas pick for .xls (usually xlrd)
                
                excel_dataframe = pd.read_excel(chosen_file_path, sheet_name=0, engine=excel_engine_to_use) # Read first sheet
                
                if excel_dataframe.empty:
                    QMessageBox.warning(self, "Empty Excel File", f"The selected Excel file (or its first sheet) '{os.path.basename(chosen_file_path)}' appears to be empty or contains no usable data.")
                    self.excel_file_status_label.setText(f"⚠️ Empty file or sheet: {os.path.basename(chosen_file_path)}")
                    self.status_bar.clearMessage()
                    return

                # Convert DataFrame to CSV string format in memory
                csv_string_buffer = io.StringIO()
                excel_dataframe.to_csv(csv_string_buffer, index=False) # Exclude DataFrame index from CSV
                self.data_content_from_file_or_url = csv_string_buffer.getvalue() # Store CSV string
                self.loaded_excel_file_path = chosen_file_path # Store path of successfully loaded file
                
                num_rows_loaded = len(excel_dataframe)
                num_cols_loaded = len(excel_dataframe.columns)
                self.excel_file_status_label.setText(f"✅ Loaded: {os.path.basename(chosen_file_path)} ({num_rows_loaded} rows, {num_cols_loaded} columns)")
                self.status_bar.showMessage(f"📊 Excel data loaded successfully: {num_rows_loaded} rows from {os.path.basename(chosen_file_path)}", 7000)
                self.append_message_to_log_area(f"<i>Data loaded from Excel file: '{chosen_file_path}' ({num_rows_loaded} data rows, {num_cols_loaded} columns/headers).</i>")

            except ImportError as import_err: # Specifically for missing pandas engines (openpyxl, xlrd)
                 QMessageBox.critical(self, "Missing Excel Engine Library", f"Could not load Excel file '{os.path.basename(chosen_file_path)}'.\nA required library for processing this Excel format is missing: {str(import_err)}.\nPlease ensure 'openpyxl' (for .xlsx) or 'xlrd' (for older .xls) is installed.")
                 self.excel_file_status_label.setText(f"❌ Failed (missing engine): {os.path.basename(chosen_file_path)}")
                 self.status_bar.clearMessage()
            except Exception as e: # Catch other pandas or file reading errors
                QMessageBox.critical(self, "Error Loading Excel File", f"An error occurred while attempting to load the Excel file '{os.path.basename(chosen_file_path)}':\n{str(e)}")
                self.loaded_excel_file_path = None # Clear path on error
                self.data_content_from_file_or_url = None # Clear data on error
                self.excel_file_status_label.setText(f"❌ Failed to load: {os.path.basename(chosen_file_path)}")
                self.status_bar.clearMessage()


    def trigger_load_google_sheet_data(self):
        """Initiate fetching Google Sheet data as CSV via a configured Apps Script Web App."""
        google_sheet_url_str = self.google_sheet_url_field.text().strip()
        if not google_sheet_url_str or not (google_sheet_url_str.startswith("https://docs.google.com/spreadsheets/d/") or "gid=" in google_sheet_url_str):
            QMessageBox.warning(self, "Invalid Google Sheet URL", "Please enter a valid Google Sheet URL.\nIt should typically start with 'https://docs.google.com/spreadsheets/d/'.")
            return

        # This feature requires "Google Apps Script" to be the selected sending method, as it uses its Web App URL.
        if "Apps Script" not in self.send_via_combo_box.currentText():
            QMessageBox.warning(self, "Configuration Prerequisite", "Fetching Google Sheet data currently requires 'Google Apps Script' to be selected as the sending method. This is because it uses an Apps Script Web App URL for the fetching process. Please select an Apps Script account.")
            return

        selected_as_accounts_for_gsheet_fetch = self.get_selected_as_accounts_from_ui()
        if not selected_as_accounts_for_gsheet_fetch:
            QMessageBox.warning(self, "Apps Script Account Required", "No Apps Script account is currently selected. Please select one to use its configured Web App URL for fetching Google Sheet data.")
            return
        
        # Use the Web App URL from the first selected Apps Script account for fetching.
        # Assumes the Apps Script at that URL is deployed to handle a 'getSheetData' action.
        web_app_url_to_use_for_fetch = selected_as_accounts_for_gsheet_fetch[0].get('web_app_url')
        if not web_app_url_to_use_for_fetch:
            as_account_id = selected_as_accounts_for_gsheet_fetch[0].get('nickname', selected_as_accounts_for_gsheet_fetch[0].get('email'))
            QMessageBox.warning(self, "Web App URL Missing", f"The selected Apps Script account ('{as_account_id}') does not have a Web App URL configured. This URL is required to fetch Google Sheet data.")
            return

        if self.sheet_fetcher_thread_instance and self.sheet_fetcher_thread_instance.isRunning():
            QMessageBox.information(self, "Operation Already in Progress", "A Google Sheet data fetching operation is already active. Please wait for it to complete or stop it if necessary.")
            return

        self.fetch_google_sheet_data_button.setEnabled(False) # Disable button during fetch
        self.google_sheet_status_label.setText(f"🌐 Fetching data from Google Sheet... (URL ending: ...{google_sheet_url_str[-35:]})")
        self.status_bar.showMessage("Requesting Google Sheet data via Apps Script... Please wait.", 0) # Persistent
        QApplication.processEvents() # Update UI

        # Use current application proxy settings for the fetch request, if any
        proxy_config_for_fetch = self.get_active_proxy_config_dict() 
        
        self.sheet_fetcher_thread_instance = SheetFetcherThread(web_app_url_to_use_for_fetch, google_sheet_url_str, proxy_config_for_fetch)
        self.sheet_fetcher_thread_instance.sheet_data_fetched_signal.connect(self.on_google_sheet_data_fetched_result)
        self.sheet_fetcher_thread_instance.finished.connect(self.on_sheet_fetcher_thread_cleanup) # For resource cleanup
        self.sheet_fetcher_thread_instance.start()


    def on_google_sheet_data_fetched_result(self, fetch_success_flag, fetched_data_or_error_msg, original_sheet_url):
        """Callback for when Google Sheet data fetching thread (SheetFetcherThread) completes."""
        self.status_bar.clearMessage() # Clear "Requesting..." status message
        if fetch_success_flag:
            self.data_content_from_file_or_url = fetched_data_or_error_msg # This is the CSV string data
            self.loaded_google_sheet_url = original_sheet_url # Store URL of successfully loaded sheet
            
            try: # Estimate number of rows from CSV string for display
                num_lines_in_csv = len(fetched_data_or_error_msg.splitlines())
                num_data_rows = num_lines_in_csv - 1 if num_lines_in_csv > 0 else 0 # Subtract header row
            except: num_data_rows = "N/A" # Should not happen with string data

            short_url_for_display = original_sheet_url[-45:] if len(original_sheet_url) > 45 else original_sheet_url
            self.google_sheet_status_label.setText(f"✅ Data loaded from GSheet: ...{short_url_for_display} ({num_data_rows} data rows)")
            self.status_bar.showMessage(f"📊 Google Sheet data fetched successfully: {num_data_rows} data rows.", 7000)
            self.append_message_to_log_area(f"<i>Data loaded from Google Sheet: '{original_sheet_url}' ({num_data_rows} data rows). Ensure Apps Script returns CSV format.</i>")
        else: # Fetching failed
            self.data_content_from_file_or_url = None # Clear any old data
            self.loaded_google_sheet_url = None # Clear loaded URL
            self.google_sheet_status_label.setText(f"❌ Failed to load GSheet: {fetched_data_or_error_msg[:120]}...") # Show truncated error
            QMessageBox.critical(self, "Google Sheet Fetch Error", 
                                 f"Could not fetch data from Google Sheet URL:\n'{original_sheet_url}'\n\n"
                                 f"Error reported: {fetched_data_or_error_msg}\n\n"
                                 "Please ensure:\n"
                                 "1. The Apps Script is correctly deployed (Execute as 'Me', Access 'Anyone').\n"
                                 "2. The Google Sheet is accessible (e.g., 'Anyone with the link can view') by the Google account associated with the Apps Script.\n"
                                 "3. The Apps Script Web App URL is correct and handles the 'getSheetData' action.")
        
        self.fetch_google_sheet_data_button.setEnabled(True) # Re-enable fetch button


    def on_sheet_fetcher_thread_cleanup(self):
        """Cleans up the SheetFetcherThread instance after it has finished its execution."""
        self.fetch_google_sheet_data_button.setEnabled(True) # Ensure button is re-enabled
        if self.sheet_fetcher_thread_instance:
            # self.sheet_fetcher_thread_instance.quit() # Not strictly necessary if run() completes naturally
            # self.sheet_fetcher_thread_instance.wait() # Also not needed if run() exits
            self.sheet_fetcher_thread_instance.deleteLater() # Safe Qt way to delete QObject from potentially different thread context
            self.sheet_fetcher_thread_instance = None
            print("SheetFetcherThread instance cleaned up after finishing.")


    # --- AI/Gemini Integration ---
    def on_gemini_api_key_changed_save(self):
        """Saves the Gemini API key from UI input field to QSettings and instance variable when editing is finished."""
        if self.gemini_api_key_input_field: # Check if UI element exists
            self.gemini_api_key = self.gemini_api_key_input_field.text().strip()
            self.settings.setValue(GEMINI_API_KEY_SETTING, self.gemini_api_key) # Save to QSettings
            if self.gemini_api_key:
                self.status_bar.showMessage("🤖 Gemini API Key saved successfully.", 3000)
            else:
                self.status_bar.showMessage("🤖 Gemini API Key cleared from settings.", 3000)
            self.update_ai_tools_tab_status_display() # Update tab appearance based on key presence


    def trigger_gemini_subject_generation(self):
        """Initiates subject line generation using Gemini AI via GeminiSubjectGeneratorThread."""
        if not GEMINI_API_AVAILABLE:
            QMessageBox.warning(self, "Feature Disabled", f"Gemini AI features are disabled because the required library is not found or failed to import.\nDetails: {GEMINI_IMPORT_ERROR}\nPlease install 'google-generativeai' (e.g., 'pip install google-generativeai') and restart the application.")
            if hasattr(self, 'generate_ai_subjects_button'): self.generate_ai_subjects_button.setEnabled(False)
            return

        # Get API key from UI field (preferred) or internal variable (loaded from settings)
        api_key_to_use_for_gemini = self.gemini_api_key_input_field.text().strip() if self.gemini_api_key_input_field else self.gemini_api_key
        if not api_key_to_use_for_gemini:
            QMessageBox.warning(self, "Gemini API Key Missing", "Please enter your Google Gemini API Key in the 'Gemini API Setup' section to use this feature. You can obtain a key from Google AI Studio.")
            if self.gemini_api_key_input_field: self.gemini_api_key_input_field.setFocus() # Focus the key input field
            return

        base_idea_for_subject_gen = self.base_subject_idea_field.text().strip()
        if not base_idea_for_subject_gen:
            QMessageBox.warning(self, "Input Required for AI", "Please provide a base idea, keywords, or a sample subject in the 'Base Idea/Keywords' field for the AI to work with.")
            self.base_subject_idea_field.setFocus()
            return

        if self.gemini_subject_gen_thread_instance and self.gemini_subject_gen_thread_instance.isRunning():
            QMessageBox.information(self, "Operation Already in Progress", "Subject line generation with Gemini AI is already active. Please wait for it to complete.")
            return

        num_subjects_to_request = self.num_subjects_to_gen_spinbox.value()

        self.generate_ai_subjects_button.setEnabled(False) # Disable button during generation
        self.generated_subjects_display_list.clear() # Clear previous results
        self.generated_subjects_display_list.addItem("🤖 Generating subject lines with Gemini AI... Please wait, this may take a moment...")
        self.status_bar.showMessage("Communicating with Google Gemini AI for subject line generation...", 0) # Persistent
        QApplication.processEvents() # Update UI


        self.gemini_subject_gen_thread_instance = GeminiSubjectGeneratorThread(api_key_to_use_for_gemini, base_idea_for_subject_gen, num_subjects_to_request)
        self.gemini_subject_gen_thread_instance.generation_finished.connect(self.on_gemini_subjects_generated_result)
        self.gemini_subject_gen_thread_instance.finished.connect(self.on_gemini_subject_gen_thread_cleanup) # For resource cleanup
        self.gemini_subject_gen_thread_instance.start()


    def on_gemini_subjects_generated_result(self, generation_success_flag, generated_subjects_list, error_message_str):
        """Callback for when Gemini subject generation thread (GeminiSubjectGeneratorThread) completes."""
        self.status_bar.clearMessage() # Clear "Communicating..." status
        self.generated_subjects_display_list.clear() # Clear "Generating..." placeholder item
        
        if generation_success_flag and generated_subjects_list:
            self.generated_subjects_display_list.addItems(generated_subjects_list)
            self.status_bar.showMessage(f"🤖 Successfully generated {len(generated_subjects_list)} subject line suggestion(s) with Gemini AI.", 7000)
            self.append_message_to_log_area(f"<i>AI successfully generated {len(generated_subjects_list)} subject suggestions based on '{self.base_subject_idea_field.text()[:50]}...'.</i>")
        elif generation_success_flag and not generated_subjects_list: # API call succeeded but no usable subjects extracted
            message_to_show = error_message_str or "Gemini AI returned a response, but no valid subject lines could be extracted. Try rephrasing your base idea or checking the prompt guidelines."
            self.generated_subjects_display_list.addItem(f"⚠️ {message_to_show}")
            QMessageBox.information(self, "Gemini Generation Note", message_to_show)
        else: # Generation failed (API error, network issue, etc.)
            self.generated_subjects_display_list.addItem(f"❌ Error during subject generation: {error_message_str}")
            QMessageBox.critical(self, "Gemini AI Generation Failed", 
                                 f"Failed to generate subject lines using Gemini AI:\n{error_message_str}\n\n"
                                 "Please check:\n"
                                 "1. Your Gemini API Key is correct and active.\n"
                                 "2. Your internet connection.\n"
                                 "3. The base idea/keywords provided (try simplifying or rephrasing).\n"
                                 "4. Google AI Platform status for any service outages.")
        
        self.generate_ai_subjects_button.setEnabled(True) # Re-enable the generate button


    def on_gemini_subject_gen_thread_cleanup(self):
        """Cleans up the GeminiSubjectGeneratorThread instance after it has finished."""
        self.generate_ai_subjects_button.setEnabled(True) # Ensure button is re-enabled
        if self.gemini_subject_gen_thread_instance:
            self.gemini_subject_gen_thread_instance.deleteLater()
            self.gemini_subject_gen_thread_instance = None
            print("GeminiSubjectGeneratorThread instance cleaned up after finishing.")


    def on_generated_subject_double_clicked_add_to_editor(self, clicked_list_widget_item):
        """Adds a subject from the AI-generated list (on double-click) to the main subject editor in the 'Email Content' tab."""
        subject_text_to_add_to_editor = clicked_list_widget_item.text().strip()
        
        # Avoid adding status/error messages from the list to the editor
        if subject_text_to_add_to_editor and not subject_text_to_add_to_editor.startswith(("🤖", "⚠️", "❌")):
            current_subjects_text_in_editor = self.subject_lines_text_editor.toPlainText().strip()
            
            # Append as a new line if the editor already has content, otherwise set as first line
            if current_subjects_text_in_editor:
                self.subject_lines_text_editor.setPlainText(current_subjects_text_in_editor + "\n" + subject_text_to_add_to_editor)
            else:
                self.subject_lines_text_editor.setPlainText(subject_text_to_add_to_editor)
            
            self.subject_lines_text_editor.moveCursor(QTextCursor.End) # Move cursor to the end of the editor
            self.status_bar.showMessage(f"➕ AI-generated subject added to editor: '{subject_text_to_add_to_editor[:50]}...'", 4000)
            
            # Optionally, switch focus to the 'Email Content' tab and the subject editor
            for i in range(self.main_tab_widget.count()):
                if self.main_tab_widget.widget(i) == self.email_content_creation_tab:
                    self.main_tab_widget.setCurrentIndex(i)
                    self.subject_lines_text_editor.setFocus() 
                    break


    def update_ai_tools_tab_status_display(self):
        """Updates the AI Tools tab text and enabled state based on library availability and API key presence."""
        ai_tools_tab_widget_index = -1
        for i in range(self.main_tab_widget.count()):
            if self.main_tab_widget.widget(i) == self.ai_tools_suite_tab:
                ai_tools_tab_widget_index = i
                break
        if ai_tools_tab_widget_index == -1: return # AI tab not found in main tab widget

        ai_tools_tab_content_widget = self.main_tab_widget.widget(ai_tools_tab_widget_index)

        if not GEMINI_API_AVAILABLE:
            self.main_tab_widget.setTabText(ai_tools_tab_widget_index, "🤖 AI Tools (Library Missing!)")
            self.main_tab_widget.setTabToolTip(ai_tools_tab_widget_index, f"Gemini AI features are disabled: {GEMINI_IMPORT_ERROR}. Please install 'google-generativeai'.")
            if ai_tools_tab_content_widget: ai_tools_tab_content_widget.setEnabled(False) # Disable entire tab content
            if hasattr(self, 'generate_ai_subjects_button'): self.generate_ai_subjects_button.setEnabled(False)
        else: # Gemini library is available
            if ai_tools_tab_content_widget: ai_tools_tab_content_widget.setEnabled(True) # Enable tab content
            
            # Check if API key is present (from UI input or loaded setting)
            is_api_key_present = False
            if self.gemini_api_key_input_field and self.gemini_api_key_input_field.text().strip():
                is_api_key_present = True
            elif hasattr(self, 'gemini_api_key') and self.gemini_api_key and self.gemini_api_key.strip(): # Check instance var if UI field not yet fully init
                is_api_key_present = True
            
            if not is_api_key_present:
                self.main_tab_widget.setTabText(ai_tools_tab_widget_index, "🤖 AI Subject Helper (API Key Needed)")
                self.main_tab_widget.setTabToolTip(ai_tools_tab_widget_index, "Gemini API Key is not set. Please provide it in the API Setup section of this tab to enable AI features.")
                # Button can remain enabled to allow user to click and be prompted for key.
                if hasattr(self, 'generate_ai_subjects_button'): self.generate_ai_subjects_button.setEnabled(True) 
            else:
                self.main_tab_widget.setTabText(ai_tools_tab_widget_index, "🤖 AI Subject Helper")
                self.main_tab_widget.setTabToolTip(ai_tools_tab_widget_index, "Generate diverse email subject line variations using Google Gemini AI.")
                if hasattr(self, 'generate_ai_subjects_button'): self.generate_ai_subjects_button.setEnabled(True)


    # --- Settings Management ---
    def load_application_settings(self):
        """Load application settings from QSettings into UI elements and instance variables."""
        print("Loading application settings...")
        # Window geometry and state
        self.restoreGeometry(self.settings.value("MainWindow/geometry", QByteArray()))
        self.restoreState(self.settings.value("MainWindow/windowState", QByteArray()))
        
        # Performance settings
        self.max_concurrent_sends_per_batch_worker = self.settings.value(MAX_CONCURRENT_SENDS_SETTING, 20, type=int)
        if hasattr(self, 'max_concurrent_sends_spinbox_ref'):
            self.max_concurrent_sends_spinbox_ref.setValue(self.max_concurrent_sends_per_batch_worker)
        
        self.batch_size_for_main_workers = self.settings.value("batch_size", 50, type=int)
        if hasattr(self, 'batch_size_spinbox_ref'):
            self.batch_size_spinbox_ref.setValue(self.batch_size_for_main_workers)

        # Gemini API Key
        self.gemini_api_key = self.settings.value(GEMINI_API_KEY_SETTING, "", type=str)
        if hasattr(self, 'gemini_api_key_input_field') and self.gemini_api_key_input_field:
            self.gemini_api_key_input_field.setText(self.gemini_api_key)
        # self.update_ai_tools_tab_status_display() called at end of __init__ after all UI is up

        # Proxy settings - Load into instance variables, then update UI
        self.proxy_is_enabled = self.settings.value(PROXY_ENABLED_SETTING, False, type=bool)
        self.proxy_config_type = self.settings.value(PROXY_TYPE_SETTING, "HTTP", type=str)
        self.proxy_config_host = self.settings.value(PROXY_HOST_SETTING, "", type=str)
        self.proxy_config_port = self.settings.value(PROXY_PORT_SETTING, "", type=str)
        self.proxy_config_user = self.settings.value(PROXY_USER_SETTING, "", type=str)
        self.proxy_config_pass = self.settings.value(PROXY_PASS_SETTING, "", type=str) # TODO: Encrypt/decrypt this if stored
        
        # TODO: Update Proxy UI elements if/when they are added to a dedicated settings dialog or tab
        # Example: if hasattr(self, 'proxy_enabled_checkbox_ref'): self.proxy_enabled_checkbox_ref.setChecked(self.proxy_is_enabled) ...etc.

        # Test Email settings
        self.test_email_target_address = self.settings.value(TEST_EMAIL_ADDRESS_SETTING, "", type=str)
        self.test_email_trigger_count = self.settings.value(TEST_AFTER_X_EMAILS_SETTING, 0, type=int)
        if hasattr(self, 'test_email_address_input_field') and self.test_email_address_input_field:
            self.test_email_address_input_field.setText(self.test_email_target_address)
        if hasattr(self, 'test_after_x_emails_spinbox_ref') and self.test_after_x_emails_spinbox_ref:
            self.test_after_x_emails_spinbox_ref.setValue(self.test_email_trigger_count)
        
        # Splitter states
        if hasattr(self, 'compose_tab_horizontal_splitter') and self.compose_tab_horizontal_splitter:
            self.compose_tab_horizontal_splitter.restoreState(self.settings.value("Splitters/composeTabHorizontal", QByteArray()))
        
        # Last used send_via method (handled by populate_send_via_combo_from_settings in __init__)
        # Last used theme (handled by apply_stylesheet in __init__)
        print("Application settings loaded.")


    def save_application_settings(self):
        """Save current application settings using QSettings."""
        print("Saving application settings...")
        # Window geometry and state
        self.settings.setValue("MainWindow/geometry", self.saveGeometry())
        self.settings.setValue("MainWindow/windowState", self.saveState())
        
        # Performance settings
        if hasattr(self, 'max_concurrent_sends_spinbox_ref'):
            self.settings.setValue(MAX_CONCURRENT_SENDS_SETTING, self.max_concurrent_sends_spinbox_ref.value())
        if hasattr(self, 'batch_size_spinbox_ref'):
            self.settings.setValue("batch_size", self.batch_size_spinbox_ref.value())

        # Gemini API Key
        if hasattr(self, 'gemini_api_key_input_field') and self.gemini_api_key_input_field:
            self.settings.setValue(GEMINI_API_KEY_SETTING, self.gemini_api_key_input_field.text().strip())
        
        # Proxy settings (save from instance variables, assuming they are source of truth or updated by UI)
        # TODO: If UI elements for proxy are added, save from them directly.
        self.settings.setValue(PROXY_ENABLED_SETTING, self.proxy_is_enabled)
        self.settings.setValue(PROXY_TYPE_SETTING, self.proxy_config_type)
        self.settings.setValue(PROXY_HOST_SETTING, self.proxy_config_host)
        self.settings.setValue(PROXY_PORT_SETTING, self.proxy_config_port)
        self.settings.setValue(PROXY_USER_SETTING, self.proxy_config_user)
        # WARNING: Storing passwords in plain text via QSettings is insecure. Implement encryption.
        self.settings.setValue(PROXY_PASS_SETTING, self.proxy_config_pass) 

        # Test Email settings
        if hasattr(self, 'test_email_address_input_field') and self.test_email_address_input_field:
            self.settings.setValue(TEST_EMAIL_ADDRESS_SETTING, self.test_email_address_input_field.text().strip())
        if hasattr(self, 'test_after_x_emails_spinbox_ref') and self.test_after_x_emails_spinbox_ref:
            self.settings.setValue(TEST_AFTER_X_EMAILS_SETTING, self.test_after_x_emails_spinbox_ref.value())

        # Splitter states
        if hasattr(self, 'compose_tab_horizontal_splitter') and self.compose_tab_horizontal_splitter:
            self.settings.setValue("Splitters/composeTabHorizontal", self.compose_tab_horizontal_splitter.saveState())

        # Last used send_via method
        if hasattr(self, 'send_via_combo_box'):
            self.settings.setValue(SEND_VIA_SETTING, self.send_via_combo_box.currentText())

        # Theme
        self.settings.setValue("theme", self.current_theme) # self.current_theme updated by apply_stylesheet

        self.settings.sync() # Ensure settings are written to disk immediately
        print("Application settings saved successfully.")


if __name__ == '__main__':
    # --- Application Entry Point ---
    # Enable High DPI scaling for better visuals on high-resolution displays
    if hasattr(Qt, 'AA_EnableHighDpiScaling'):
        QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    if hasattr(Qt, 'AA_UseHighDpiPixmaps'):
        QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    
    # Create application configuration directory if it doesn't exist (critical step)
    if not os.path.exists(CONFIG_DIR_PATH_BASE):
        try:
            os.makedirs(CONFIG_DIR_PATH_BASE, exist_ok=True)
            print(f"✅ Configuration directory created/verified: {CONFIG_DIR_PATH_BASE}")
        except OSError as e:
            # Attempt to show a QMessageBox if QApplication can be initialized for it
            # This is a fallback if directory creation fails right at startup.
            temp_app_for_msgbox = QApplication.instance() 
            if not temp_app_for_msgbox: temp_app_for_msgbox = QApplication(sys.argv)
            
            QMessageBox.critical(None, "Fatal Startup Error", 
                                 f"Could not create the application configuration directory:\n{CONFIG_DIR_PATH_BASE}\n\nError: {e}\n\n"
                                 "The application requires this directory to store settings and account configurations. Please check permissions or disk space.\n\n"
                                 "The application will now exit.")
            sys.exit(1) # Exit if config dir is critical and cannot be made
        
    app = QApplication(sys.argv)
    
    # Set application name and organization for QSettings
    # This should match what's used in MailerApp constructor for QSettings.
    app.setOrganizationName("MyCompanyOrAppName") # Use a consistent organization name
    app.setApplicationName(CONFIG_DIR_NAME_BASE + APP_VERSION_SUFFIX) # Consistent application name

    # Initialize and show the main application window
    mailer_app_instance = MailerApp()
    mailer_app_instance.show() 
    
    # Welcome messages to console
    print("\n" + "="*60)
    print(f"🚀 High-Speed Email Mailer Initialized ({CONFIG_DIR_NAME_BASE + APP_VERSION_SUFFIX}) 🚀")
    print(f"   Version Suffix: {APP_VERSION_SUFFIX}")
    print("   Configuration Directory: " + CONFIG_DIR_PATH_BASE)
    print("="*60)
    print("⚡ Key Features & Optimizations:")
    print("   • Asynchronous Batch Processing with ThreadPoolExecutor for High Concurrency")
    print("   • Advanced Per-Server Rate Limiting with Burst Capability for SMTP")
    print("   • Full Campaign Preparation Before Sending (Content Resolution Focus)")
    print("   • Dynamic Placeholder {{data}} and Tag {{[tag]}} Resolution System")
    print("   • Spintax {option1|option2} Support for Content Variation")
    print("   • Multiple Sender Account Management (Google Apps Script, Generic SMTP)")
    print("   • Data Import from Pasted CSV, Excel Files, Google Sheets (via Apps Script)")
    print("   • Google Gemini AI Integration for Subject Line Generation")
    print("   • Real-time Performance Monitoring and Detailed Send Logging")
    print("   • Configurable High-Speed Settings (Concurrency, Batch Sizes)")
    print("   • Robust Error Handling and User Feedback Mechanisms")
    print("="*60 + "\n")
    
    # Display warnings for missing optional libraries
    if not PANDAS_AVAILABLE: print(f"⚠️ WARNING: {PANDAS_IMPORT_ERROR}")
    if not GEMINI_API_AVAILABLE: print(f"⚠️ WARNING: {GEMINI_IMPORT_ERROR}")
    if not WEBENGINE_AVAILABLE: print(f"⚠️ WARNING: {WEBENGINE_IMPORT_ERROR}")

    sys.exit(app.exec_())
